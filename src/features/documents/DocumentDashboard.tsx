import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Search,
  ShieldCheck,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import { StudentService } from "../../services/studentService";
import { KpiTrendIndicator } from "../../components/common/KpiTrendIndicator";
import { DocumentService, type DocumentRecord } from "../../services/documentService";
import { notifyError, notifySuccess } from "../../components/common/CrmNotifications";
import { validateDocumentFiles } from "../../lib/documentUploadPolicy";

type DocItem = DocumentRecord;

const DOCUMENT_CATEGORIES = [
  "All Categories",
  "Passport & Identity",
  "Academic Transcripts",
  "English Test Results",
  "Financial Documents",
  "Visa & Embassy Files",
  "Recommendation Letters",
  "Others",
] as const;

const DOCUMENT_CHECKLIST = [
  { item: "Valid Passport (Minimum 6 Months Validity)", category: "Passport & Identity", mandatory: true, requirement: "Color scan of bio-data page" },
  { item: "Citizenship Certificate (With English Translation)", category: "Passport & Identity", mandatory: true, requirement: "Notarized English translation required" },
  { item: "Grade 10 / SEE / SLC Marksheet & Certificate", category: "Academic Transcripts", mandatory: true, requirement: "Original scanned copy" },
  { item: "Grade 12 / +2 Transcript & Character Certificate", category: "Academic Transcripts", mandatory: true, requirement: "HSEB / NEB issued certificates" },
  { item: "Bachelor / Degree Transcripts & Provisional Certificate", category: "Academic Transcripts", mandatory: true, requirement: "For postgraduate/masters applicants" },
  { item: "Official English Test Scorecard (IELTS / PTE / TOEFL)", category: "English Test Results", mandatory: true, requirement: "Valid within 2 years of intake" },
  { item: "Statement of Purpose (SOP / GTE Essay)", category: "Visa & Embassy Files", mandatory: true, requirement: "Genuine intention essay reviewed by senior counsellor" },
  { item: "Academic & Professional Reference Letters (2 Required)", category: "Recommendation Letters", mandatory: true, requirement: "Issued on official institutional letterhead" },
  { item: "Property Valuation & Source of Income Proof", category: "Financial Documents", mandatory: true, requirement: "Municipal relationship & tax clearance verification" },
  { item: "No Objection Certificate (NOC Nepal)", category: "Visa & Embassy Files", mandatory: true, requirement: "Ministry of Education (MOEST) verified NOC" },
];

const INITIAL_DOCS: DocItem[] = [];

const STATUS_CONFIG: Record<DocItem["status"], { label: string; tone: string }> = {
  VERIFIED: { label: "Verified", tone: "enrolled" },
  UNDER_REVIEW: { label: "Under Review", tone: "counselling" },
  ACTION_REQUIRED: { label: "Action Required", tone: "new-lead" },
  EXPIRED: { label: "Expired", tone: "visa" },
  REJECTED: { label: "Rejected", tone: "visa" },
};

export function DocumentDashboard() {
  const [docs, setDocs] = useState<DocItem[]>(INITIAL_DOCS);
  const [students, setStudents] = useState<Array<{id:string;student_code:string;full_name:string}>>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"files" | "checklist">("files");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [inspectDoc, setInspectDoc] = useState<DocItem | null>(null);

  const [uploadForm, setUploadForm] = useState({
    studentCode: "",
    studentName: "",
    fileName: "",
    category: "Passport & Identity",
    fileSize: "",
    status: "UNDER_REVIEW" as DocItem["status"],
    expiresOn: "",
    notes: "",
  });

  useEffect(() => {
    Promise.all([StudentService.getStudents(), DocumentService.list()]).then(([studentRows,documents]) => {
      setStudents(studentRows || []);
      setDocs(documents);
      if (studentRows && studentRows.length > 0) {
        setUploadForm(prev => ({
          ...prev,
          studentCode: studentRows[0].student_code,
          studentName: studentRows[0].full_name,
        }));
      }
    }).catch(error=>setErrorMessage(error instanceof Error?error.message:"Unable to load document vault.")).finally(()=>setLoading(false));
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiles.length) return;
    setSaving(true);setErrorMessage("");
    try{const results=await Promise.allSettled(selectedFiles.map(file=>DocumentService.upload({studentCode:uploadForm.studentCode,category:uploadForm.category,title:selectedFiles.length===1&&uploadForm.fileName.trim()?uploadForm.fileName.trim():file.name.replace(/\.[^.]+$/,""),file,expiresOn:uploadForm.expiresOn,notes:uploadForm.notes})));const failures=results.filter(result=>result.status==="rejected");if(failures.length)throw new Error(`${selectedFiles.length-failures.length} uploaded; ${failures.length} failed.`);setDocs(await DocumentService.list());setShowUploadModal(false);setSelectedFiles([]);notifySuccess(`${results.length} document${results.length===1?"":"s"} uploaded`,`The files are secure and ready for verification.`);setUploadForm({
      studentCode: students.length > 0 ? students[0].student_code : "",
      studentName: students.length > 0 ? students[0].full_name : "",
      fileName: "",
      category: "Passport & Identity",
      fileSize: "",
      status: "UNDER_REVIEW",
      expiresOn:"",notes:"",
    });}catch(error){const message=error instanceof Error?error.message:"Upload failed.";setErrorMessage(message);notifyError("Document upload failed",message)}finally{setSaving(false)}
  };

  const handleUpdateStatus = async (id: string, newStatus: DocItem["status"]) => {
    setSaving(true);setErrorMessage("");try{await DocumentService.review(id,newStatus);const updated=await DocumentService.list();setDocs(updated);setInspectDoc(updated.find(d=>d.id===id)??null);const labels:Record<DocItem["status"],string>={VERIFIED:"Document verified",ACTION_REQUIRED:"Action requested",REJECTED:"Document rejected",UNDER_REVIEW:"Review status updated",EXPIRED:"Document marked expired"};notifySuccess(labels[newStatus],"The verification audit and student record were updated successfully.")}catch(error){const message=error instanceof Error?error.message:"Review failed.";setErrorMessage(message);notifyError("Status update failed",message)}finally{setSaving(false)}
  };

  const exportCSV = () => {
    const headers = ["Student Code,Student Name,Document Name,Category,File Size,Status,Verified By\n"];
    const rows = docs.map(
      d => `"${d.studentCode}","${d.studentName}","${d.fileName}","${d.category}","${d.fileSize}","${d.status}","${d.verifiedBy || "—"}"\n`
    );
    const blob = new Blob([...headers, ...rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AECS_Document_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredDocs = docs.filter(doc => {
    const matchesCategory = selectedCategory === "All Categories" || doc.category === selectedCategory;
    const matchesStatus = selectedStatus === "ALL" || doc.status === selectedStatus;
    const matchesSearch =
      doc.fileName.toLowerCase().includes(search.toLowerCase()) ||
      doc.studentName.toLowerCase().includes(search.toLowerCase()) ||
      doc.studentCode.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  return (
    <div className="page-container">
      {/* Header Row */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>Student Document Vault & Scrutiny Checklist</h2>
          <p>
            Audit academic transcripts, passport bio-pages, English TRFs, bank balance proofs, and 10-point standard visa documentation.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={exportCSV}
            title="Export Document Audit Register to CSV"
          >
            <Download size={15} />
            <span>Export Audit Log</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowUploadModal(true)}
          >
            <UploadCloud size={16} />
            <span>Upload Student Document</span>
          </button>
        </div>
      </div>
      {errorMessage&&<div className="phase2-alert phase2-alert-error" role="alert"><AlertCircle size={17}/>{errorMessage}<button type="button" onClick={()=>setErrorMessage("")}><X size={15}/></button></div>}
      {loading&&<div className="phase2-loading" role="status">Loading private document vault…</div>}
      {saving&&<div className="phase2-saving" role="status">Securing document…</div>}

      {/* Flagship Metric Strip */}
      <div className="metrics-grid-4">
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Total Uploaded Files</span>
            <div className="metric-icon-wrap blue">
              <FileSpreadsheet size={17} />
            </div>
          </div>
          <div className="metric-value">{docs.length}</div>
          <KpiTrendIndicator metricKey="documents.total" value={docs.length} label={`Across ${students.length} registered candidates`} />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Verified Documents</span>
            <div className="metric-icon-wrap green">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="metric-value">{docs.filter(d => d.status === "VERIFIED").length}</div>
          <span className="metric-sub">
            {docs.length > 0
              ? `${Math.round((docs.filter(d => d.status === "VERIFIED").length / docs.length) * 100)}% compliance clearance`
              : "0% compliance clearance"}
          </span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Under Scrutiny</span>
            <div className="metric-icon-wrap amber">
              <Clock size={17} />
            </div>
          </div>
          <div className="metric-value">{docs.filter(d => d.status === "UNDER_REVIEW").length}</div>
          <KpiTrendIndicator metricKey="documents.review" value={docs.filter(d => d.status === "UNDER_REVIEW").length} label="Admissions & Visa review" />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Action Required</span>
            <div className="metric-icon-wrap purple">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="metric-value">
            {docs.filter(d => d.status === "ACTION_REQUIRED" || d.status === "EXPIRED" || d.status === "REJECTED").length}
          </div>
          <KpiTrendIndicator metricKey="documents.action-required" value={docs.filter(d => d.status === "ACTION_REQUIRED" || d.status === "EXPIRED" || d.status === "REJECTED").length} label="Expired TRF / Missing stamps" />
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="document-tabs">
        <button
          className={activeTab === "files" ? "active" : ""}
          onClick={() => setActiveTab("files")}
        >
          <FileText size={16} />
          <span>Uploaded Document Vault ({docs.length})</span>
        </button>
        <button
          className={activeTab === "checklist" ? "active" : ""}
          onClick={() => setActiveTab("checklist")}
        >
          <ShieldCheck size={16} />
          <span>Standard 10-Point Visa Document Checklist</span>
        </button>
      </div>

      {/* TAB 1: UPLOADED DOCUMENT VAULT */}
      {activeTab === "files" ? (
        <div className="crm-panel">
          <div className="filter-toolbar">
            <div className="search-input-wrap" style={{ width: "340px" }}>
              <Search size={16} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search file name, candidate name, or ID…"
              />
            </div>

            <div className="toolbar-selects">
              <select
                className="crm-select"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                {DOCUMENT_CATEGORIES.map(cat => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>

              <select
                className="crm-select"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Verification Statuses</option>
                <option value="VERIFIED">Verified</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="ACTION_REQUIRED">Action Required</option>
                <option value="EXPIRED">Expired</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Student Candidate</th>
                  <th>Document Name & File</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Uploaded Date</th>
                  <th>Verification Status</th>
                  <th>Verified By</th>
                  <th style={{ textAlign: "right", width: "120px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map(doc => {
                  const initials = doc.studentName
                    .split(" ")
                    .map(n => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setInspectDoc(doc)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "50%",
                              background: "var(--primary-navy)",
                              color: "#FFFFFF",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div className="student-name-cell">
                            <strong style={{ fontSize: "12.5px" }}>{doc.studentName}</strong>
                            <small className="account-code-cell">{doc.studentCode}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <FileText size={16} style={{ color: "var(--accent-blue)" }} />
                          <span style={{ fontWeight: 600, fontSize: "12.5px", color: "var(--text-main)" }}>
                            {doc.fileName}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: "12px", color: "var(--text-main)" }}>{doc.category}</span>
                      </td>

                      <td>
                        <span className="code-font" style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                          {doc.fileSize}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{doc.uploadedAt}</span>
                      </td>

                      <td>
                        <span className={`badge-status ${STATUS_CONFIG[doc.status].tone}`}>
                          {STATUS_CONFIG[doc.status].label}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {doc.verifiedBy || "—"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="table-actions" style={{ justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="table-btn"
                            title="Inspect Document & Audit"
                            onClick={() => setInspectDoc(doc)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="table-btn"
                            title="Download File"
                            onClick={async () => { try{window.location.assign(await DocumentService.signedUrl(doc.storagePath,true))}catch(error){setErrorMessage(error instanceof Error?error.message:"Download failed.")} }}
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB 2: STANDARD 10-POINT VISA DOCUMENT CHECKLIST */
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>AECS Standard Intake & Visa Documentation Checklist</h3>
              <p>Statutory verification guidelines for UK, Australia, Canada, USA, and Schengen visa compliance</p>
            </div>
            <span className="status-pill">10 Standard Requirements</span>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Standard Requirement</th>
                  <th>Category</th>
                  <th>Requirement Level</th>
                  <th>Statutory Verification Standard (Nepal)</th>
                </tr>
              </thead>
              <tbody>
                {DOCUMENT_CHECKLIST.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="account-code-cell">0{idx + 1}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <FileCheck2 size={16} style={{ color: item.mandatory ? "var(--accent-blue)" : "var(--text-muted)" }} />
                        <strong style={{ fontSize: "13px" }}>{item.item}</strong>
                      </div>
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <span className={`badge-status ${item.mandatory ? "enrolled" : "counselling"}`}>
                        {item.mandatory ? "Mandatory" : "Conditional"}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {item.requirement}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {showUploadModal && (
        <div className="modal-backdrop-clean" onClick={() => setShowUploadModal(false)}>
          <div className="modal-dialog-clean" onClick={e => e.stopPropagation()}>
            <div className="modal-header-clean">
              <div>
                <h3>Upload Student Document</h3>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  Attaches verified file to student dossier in secure AECS vault
                </p>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowUploadModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpload}>
              <div className="modal-body-clean">
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Select Candidate *</label>
                    {students.length > 0 ? (
                      <select
                        value={`${uploadForm.studentCode}|${uploadForm.studentName}`}
                        onChange={e => {
                          const [code, name] = e.target.value.split("|");
                          setUploadForm({ ...uploadForm, studentCode: code, studentName: name });
                        }}
                      >
                        {students.map(s => (
                          <option key={s.id} value={`${s.student_code}|${s.full_name}`}>
                            {s.full_name} ({s.student_code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="phase3-task-empty">Register a student before uploading documents.</div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Document Category *</label>
                    <select
                      value={uploadForm.category}
                      onChange={e => setUploadForm({ ...uploadForm, category: e.target.value })}
                    >
                      <option value="Passport & Identity">Passport & Identity</option>
                      <option value="Academic Transcripts">Academic Transcripts</option>
                      <option value="English Test Results">English Test Results</option>
                      <option value="Financial Documents">Financial Documents</option>
                      <option value="Visa & Embassy Files">Visa & Embassy Files</option>
                      <option value="Recommendation Letters">Recommendation Letters</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                    <label>Document title (optional for a single file)</label>
                  <input
                    type="text"
                    value={uploadForm.fileName}
                    onChange={e => setUploadForm({ ...uploadForm, fileName: e.target.value })}
                    placeholder="e.g. Tribhuvan_University_Character_Certificate.pdf"
                  />
                </div>

                <div className="form-group"><label>Select documents * (multiple files · 1 MB each · 20 MB total)</label><input type="file" multiple required accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={e=>{const files=Array.from(e.target.files??[]);e.currentTarget.value="";if(!validateDocumentFiles(files))return;setSelectedFiles(files);if(files.length===1&&!uploadForm.fileName)setUploadForm({...uploadForm,fileName:files[0].name.replace(/\.[^.]+$/,'')})}}/>{selectedFiles.length>0&&<div className="document-upload-selection"><strong>{selectedFiles.length} document{selectedFiles.length===1?"":"s"} selected</strong><span>{selectedFiles.map(file=>file.name).join(" · ")}</span></div>}</div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Expiry date</label><input type="date" value={uploadForm.expiresOn} onChange={e=>setUploadForm({...uploadForm,expiresOn:e.target.value})}/>
                  </div>

                  <div className="form-group">
                      <label>Initial status</label><input value="Under Review" disabled/>
                  </div>
                </div>
                <div className="form-group"><label>Upload notes</label><textarea rows={2} maxLength={3000} value={uploadForm.notes} onChange={e=>setUploadForm({...uploadForm,notes:e.target.value})}/></div>
              </div>

              <div className="modal-footer-clean">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving||!selectedFiles.length||students.length===0}>
                  <UploadCloud size={15} />
                  <span>{saving?"Uploading…":`Upload ${selectedFiles.length||""} document${selectedFiles.length===1?"":"s"}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT / AUDIT DOCUMENT MODAL */}
      {inspectDoc && (
        <div className="modal-backdrop-clean" onClick={() => setInspectDoc(null)}>
          <div className="modal-dialog-clean" style={{ maxWidth: "560px" }} onClick={e => e.stopPropagation()}>
            <div className="modal-header-clean">
              <div>
                <button type="button" className="btn-secondary" onClick={async()=>{try{window.open(await DocumentService.signedUrl(inspectDoc.storagePath),"_blank","noopener,noreferrer")}catch(error){setErrorMessage(error instanceof Error?error.message:"Preview failed.")}}}><Eye size={14}/>Secure preview (5 min)</button>
              </div>

              <div>
                <h3>Document Verification Audit</h3>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  {inspectDoc.studentName} · {inspectDoc.studentCode}
                </p>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setInspectDoc(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-clean" style={{ gap: "16px" }}>
              <div
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-card-subtle)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FileText size={28} style={{ color: "var(--accent-blue)" }} />
                  <div>
                    <strong style={{ fontSize: "13px", display: "block" }}>{inspectDoc.fileName}</strong>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {inspectDoc.category} · {inspectDoc.fileSize} · Version {inspectDoc.version}
                    </span>
                  </div>
                </div>
                <span className={`badge-status ${STATUS_CONFIG[inspectDoc.status].tone}`}>
                  {STATUS_CONFIG[inspectDoc.status].label}
                </span>
              </div>

              {inspectDoc.notes && (
                <div style={{ padding: "12px 14px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: "12px" }}>
                  <strong style={{ display: "block", marginBottom: "4px", color: "var(--text-main)" }}>Audit Remarks:</strong>
                  <span style={{ color: "var(--text-muted)" }}>{inspectDoc.notes}</span>
                </div>
              )}
              {inspectDoc.expiresOn&&<div className="phase2-form-note"><strong>Expiry:</strong> {new Date(inspectDoc.expiresOn).toLocaleDateString()}</div>}
              <div><strong style={{fontSize:"13px"}}>Audit history</strong><div className="phase4-audit-list">{inspectDoc.activities.map((item,index)=><div key={`${item.createdAt}-${index}`}><b>{item.action.replaceAll("_"," ")}</b><small>{item.performedBy} · {new Date(item.createdAt).toLocaleString()}</small></div>)}</div></div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
                  Set Verification Status
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={saving}
                    style={{
                      borderColor: inspectDoc.status === "VERIFIED" ? "var(--success)" : undefined,
                      color: inspectDoc.status === "VERIFIED" ? "var(--success)" : undefined,
                      fontWeight: inspectDoc.status === "VERIFIED" ? 700 : 500,
                    }}
                    onClick={() => handleUpdateStatus(inspectDoc.id, "VERIFIED")}
                  >
                    <Check size={14} />
                    <span>Verify</span>
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={saving}
                    style={{
                      borderColor: inspectDoc.status === "ACTION_REQUIRED" ? "var(--warning)" : undefined,
                      color: inspectDoc.status === "ACTION_REQUIRED" ? "var(--warning)" : undefined,
                      fontWeight: inspectDoc.status === "ACTION_REQUIRED" ? 700 : 500,
                    }}
                    onClick={() => handleUpdateStatus(inspectDoc.id, "ACTION_REQUIRED")}
                  >
                    <AlertTriangle size={14} />
                    <span>Action Required</span>
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={saving}
                    style={{
                      borderColor: inspectDoc.status === "REJECTED" ? "var(--danger)" : undefined,
                      color: inspectDoc.status === "REJECTED" ? "var(--danger)" : undefined,
                      fontWeight: inspectDoc.status === "REJECTED" ? 700 : 500,
                    }}
                    onClick={() => handleUpdateStatus(inspectDoc.id, "REJECTED")}
                  >
                    <XCircle size={14} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer-clean">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setInspectDoc(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentDashboard;
