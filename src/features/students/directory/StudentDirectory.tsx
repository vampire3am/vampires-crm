import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  Kanban,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Phone,
  PlaneTakeoff,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Table as TableIcon,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UploadCloud,
  X,
} from "lucide-react";
import { StudentDirectoryRecord, StudentPayload, StudentService } from "../../../services/studentService";
import { AECS_AUTHORIZED_COUNTRIES } from "../../../lib/destinationsData";
import { CountryFlag } from "../../../components/ui/PhoneInput";
import { DocumentRecord, DocumentService } from "../../../services/documentService";
import { notifyError, notifySuccess } from "../../../components/common/CrmNotifications";
import { validateDocumentFiles } from "../../../lib/documentUploadPolicy";

export type StudentRecord = StudentDirectoryRecord;

const COUNTRY_ALIASES: Record<string, string> = {
  UK: "GB",
  USA: "US",
  "United Kingdom": "GB",
  "United States": "US",
};
const countryCodeFor = (country: string) =>
  COUNTRY_ALIASES[country] ?? AECS_AUTHORIZED_COUNTRIES.find(item => item.name === country)?.code ?? "";

const STAGE_CONFIG: Record<StudentRecord["status"], { label: string; tone: string; colName: string }> = {
  NEW_LEAD: { label: "New Inquiry", tone: "new-lead", colName: "1. New Inquiries" },
  COUNSELLING: { label: "In Counselling", tone: "counselling", colName: "2. In Counselling" },
  APPLICATION_SUBMITTED: { label: "App Submitted", tone: "application", colName: "3. App Submitted" },
  OFFER_RECEIVED: { label: "Offer Received", tone: "offer", colName: "4. Offer Received" },
  VISA_PROCESSING: { label: "Visa Processing", tone: "visa", colName: "5. Visa Lodged" },
  ENROLLED: { label: "Enrolled & Visited", tone: "enrolled", colName: "6. Enrolled" },
};

const KANBAN_STAGES: StudentRecord["status"][] = [
  "NEW_LEAD",
  "COUNSELLING",
  "APPLICATION_SUBMITTED",
  "OFFER_RECEIVED",
  "VISA_PROCESSING",
  "ENROLLED",
];

const INITIAL_STUDENTS: StudentRecord[] = [];

export function StudentDirectory() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeStudent, setActiveStudent] = useState<StudentRecord | null>(null);
  const [loadError, setLoadError] = useState("");

  // Inspector Drawer Active Tab
  const [inspectorTab, setInspectorTab] = useState<"profile" | "academic" | "docs" | "notes">("profile");
  const [newInspectorNote, setNewInspectorNote] = useState("");
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [editForm, setEditForm] = useState<StudentPayload | null>(null);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [editorSection, setEditorSection] = useState<"identity"|"academics"|"study"|"tests">("identity");
  const [studentDocuments, setStudentDocuments] = useState<DocumentRecord[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [documentForm, setDocumentForm] = useState({ title:"", category:"Passport & Identity", expiresOn:"", notes:"" });
  const [studentPhotoUrl, setStudentPhotoUrl] = useState("");
  const [studentPhotoUrls, setStudentPhotoUrls] = useState<Record<string, string>>({});
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Quick Lead Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    dob: "",
    gender: "" as "Male" | "Female" | "Other",
    targetCountry: "",
    targetCourse: "",
    counsellor: "Unassigned",
  });

  useEffect(() => {
    StudentService.getStudents().then(data => {
      if (data && data.length > 0) {
        setStudents(data as StudentRecord[]);
      }
    }).catch(error => setLoadError(error instanceof Error ? error.message : "Students could not be loaded"));
  }, []);

  useEffect(() => {
    let active = true;
    void DocumentService.list().then(async records => {
      const latestByStudent = new Map<string, DocumentRecord>();
      for (const record of records) {
        if (record.category === "Profile Photo" && !latestByStudent.has(record.studentCode)) latestByStudent.set(record.studentCode, record);
      }
      const entries = await Promise.all([...latestByStudent].map(async ([studentCode, photo]) => [studentCode, await DocumentService.signedUrl(photo.storagePath)] as const));
      if (active) setStudentPhotoUrls(Object.fromEntries(entries));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!activeStudent || inspectorTab !== "docs") return;
    setDocumentsLoading(true); setDocumentError("");
    DocumentService.list().then(records=>setStudentDocuments(records.filter(record=>record.studentCode===activeStudent.code&&record.category!=="Profile Photo"))).catch(error=>setDocumentError(error instanceof Error?error.message:"Documents could not be loaded")).finally(()=>setDocumentsLoading(false));
  }, [activeStudent?.id, activeStudent?.code, inspectorTab]);

  useEffect(() => {
    let active = true;
    setStudentPhotoUrl("");
    if (!activeStudent) return;
    void DocumentService.list().then(async records => {
      const photo = records.find(record => record.studentCode === activeStudent.code && record.category === "Profile Photo");
      if (!photo) return;
      const url = await DocumentService.signedUrl(photo.storagePath);
      if (active) {
        setStudentPhotoUrl(url);
        setStudentPhotoUrls(current => ({...current, [activeStudent.code]: url}));
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [activeStudent?.id, activeStudent?.code]);

  const handleStudentPhotoUpload = async (file?: File) => {
    if (!file || !activeStudent) return;
    if (!(["image/jpeg", "image/png"] as string[]).includes(file.type)) {
      notifyError("Unsupported photo", "Choose a JPEG or PNG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notifyError("Photo is too large", "Choose an image smaller than 5 MB.");
      return;
    }
    setPhotoUploading(true);
    try {
      await DocumentService.upload({studentCode:activeStudent.code,category:"Profile Photo",title:`${activeStudent.fullName} profile photo`,file,expiresOn:"",notes:"Student profile image"});
      const records = await DocumentService.list();
      const photo = records.find(record => record.studentCode === activeStudent.code && record.category === "Profile Photo");
      if (photo) {
        const url = await DocumentService.signedUrl(photo.storagePath);
        setStudentPhotoUrl(url);
        setStudentPhotoUrls(current => ({...current, [activeStudent.code]: url}));
      }
      notifySuccess("Student photo updated", `${activeStudent.fullName}'s profile photo is now saved securely.`);
    } catch (error) {
      notifyError("Photo upload failed", error instanceof Error ? error.message : "The student photo could not be uploaded.");
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const uploadStudentDocument = async (event:React.FormEvent) => {
    event.preventDefault();
    if(!activeStudent||documentFiles.length===0)return;
    setDocumentSaving(true);setDocumentError("");
    try{
      const results=await Promise.allSettled(documentFiles.map(file=>DocumentService.upload({studentCode:activeStudent.code,category:documentForm.category,title:file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' '),file,expiresOn:documentForm.expiresOn,notes:documentForm.notes})));
      const failures=results.filter(result=>result.status==="rejected") as PromiseRejectedResult[];
      const records=await DocumentService.list();setStudentDocuments(records.filter(record=>record.studentCode===activeStudent.code&&record.category!=="Profile Photo"));
      if(failures.length)throw new Error(`${results.length-failures.length} uploaded; ${failures.length} failed. ${failures[0].reason instanceof Error?failures[0].reason.message:"Check document permissions."}`);
      setDocumentFiles([]);setDocumentForm({title:"",category:"Passport & Identity",expiresOn:"",notes:""});setShowDocumentUpload(false);notifySuccess(`${results.length} document${results.length===1?"":"s"} uploaded`,`${activeStudent.fullName}'s secure document vault is now up to date.`);
    }catch(error){const message=error instanceof Error?error.message:"Document upload failed";setDocumentError(message);notifyError("Document upload failed",message)}finally{setDocumentSaving(false)}
  };

  const openStudentDocument = async (document:DocumentRecord,download=false) => {
    try{const url=await DocumentService.signedUrl(document.storagePath,download);if(download){window.location.assign(url);notifySuccess("Download prepared",`${document.fileName} is downloading securely.`)}else{window.open(url,"_blank","noopener,noreferrer")}}catch(error){const message=error instanceof Error?error.message:"Document could not be opened";setDocumentError(message);notifyError("Document unavailable",message)}
  };

  const filteredStudents = students.filter(std => {
    const matchesCountry = countryFilter === "ALL" || std.targetCountry === countryFilter;
    const matchesStatus = statusFilter === "ALL" || std.status === statusFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch = [std.fullName, std.code, std.email, std.phone, std.targetCourse]
      .some(value => String(value ?? "").toLowerCase().includes(query));
    return matchesCountry && matchesStatus && matchesSearch;
  });

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    await StudentService.createStudent({
      fullName: newLeadForm.fullName,
      email: newLeadForm.email,
      phone: newLeadForm.phone,
      dob: newLeadForm.dob,
      gender: newLeadForm.gender,
      targetCountry: newLeadForm.targetCountry,
      targetCourse: newLeadForm.targetCourse || "Bachelor / Master Degree",
      counsellor: newLeadForm.counsellor,
    });

    const updated = await StudentService.getStudents();
    setStudents(updated as StudentRecord[]);
    setShowAddModal(false);
    setNewLeadForm({
      fullName: "",
      email: "",
      phone: "",
      dob: "",
      gender: "" as "Male" | "Female" | "Other",
      targetCountry: "",
      targetCourse: "",
      counsellor: "Unassigned",
    });
  };

  const handleDelete = async (id: string) => {
    const student = students.find(record => record.id === id);
    if (!confirm(`Permanently delete ${student?.fullName ?? "this student"} and their linked record? This cannot be undone.`)) return;
    try {
      const updated = await StudentService.deleteStudent(id);
      setStudents(updated as StudentRecord[]);
      if (activeStudent?.id === id) setActiveStudent(null);
      notifySuccess("Student deleted", `${student?.fullName ?? "The student"} was removed successfully.`);
    } catch (error) {
      notifyError("Student could not be deleted", error instanceof Error ? error.message : "Please check your permissions and try again.");
    }
  };

  const beginStudentEdit = (student: StudentRecord) => {
    setEditorSection("identity");
    setEditingStudent(student);
    setEditForm({
      fullName: student.fullName, email: student.email, phone: student.phone,
      dob: student.dob, gender: student.gender, address: student.address,
      targetCountry: student.targetCountry === "Undecided" ? "" : student.targetCountry,
      secondCountry: student.secondCountry, targetCourse: student.targetCourse === "Undecided" ? "" : student.targetCourse,
      targetIntake: student.targetIntake === "Undecided" ? "" : student.targetIntake,
      budget: student.budget, highestQualification: student.highestQualification,
      academicStatus: student.academicStatus, latestResult: student.latestResult,
      studyGap: student.studyGap, employmentStatus: student.employmentStatus,
      testTaken: student.englishTest.taken, testType: student.englishTest.taken ? student.englishTest.test : "",
      testScore: student.englishTest.taken ? student.englishTest.score : "",
      hasPassport: student.hasPassport, leadSource: student.leadSource, message: student.message,
    });
  };

  const saveStudentEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingStudent || !editForm) return;
    setIsUpdatingStudent(true);
    setLoadError("");
    try {
      const updated = await StudentService.updateStudent(editingStudent.id, editForm);
      setStudents(updated as StudentRecord[]);
      const refreshed = (updated as StudentRecord[]).find(student => student.id === editingStudent.id) ?? null;
      setActiveStudent(refreshed);
      setEditingStudent(null);
      setEditForm(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Student information could not be updated");
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  const handleAdvanceStage = async (std: StudentRecord) => {
    const currentIndex = KANBAN_STAGES.indexOf(std.status);
    if (currentIndex < KANBAN_STAGES.length - 1) {
      const nextStage = KANBAN_STAGES[currentIndex + 1];
      const updated = await StudentService.updateStatus(std.id, nextStage);
      setStudents(updated as StudentRecord[]);
      if (activeStudent?.id === std.id) {
        setActiveStudent({ ...activeStudent, status: nextStage });
      }
    }
  };

  const handleAddNoteToActiveStudent = () => {
    if (!newInspectorNote.trim() || !activeStudent) return;
    const updatedNotes = [newInspectorNote.trim(), ...activeStudent.notes];
    const updatedStudent = { ...activeStudent, notes: updatedNotes };
    setActiveStudent(updatedStudent);

    const updatedList = students.map(s => (s.id === activeStudent.id ? updatedStudent : s));
    setStudents(updatedList);
    localStorage.setItem("aecs_persistent_students", JSON.stringify(updatedList));
    setNewInspectorNote("");
  };

  const exportCSV = () => {
    const headers = ["Student Code,Full Name,Email,Phone,Country,Course,Status,Counsellor\n"];
    const rows = students.map(
      s => `"${s.code}","${s.fullName}","${s.email}","${s.phone}","${s.targetCountry}","${s.targetCourse}","${s.status}","${s.counsellor}"\n`
    );
    const blob = new Blob([...headers, ...rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AECS_Students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container">
      {loadError && <div className="alert-banner error" role="alert"><AlertCircle size={16}/>{loadError}</div>}
      {/* Header Row */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>Students & Admissions Pipeline</h2>
          <p>
            Official registered candidate dossiers with verified academic records, 10-point document compliance, and university admissions.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={exportCSV}
            title="Export Student Directory to CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/students/register")}
          >
            <UserPlus size={16} />
            <span>Register New Student</span>
          </button>
        </div>
      </div>

      {/* Flagship Metric Strip */}
      <div className="metrics-grid-4">
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Registered Students</span>
            <div className="metric-icon-wrap blue">
              <Users size={17} />
            </div>
          </div>
          <div className="metric-value">{students.length} Candidates</div>
          <span className="metric-sub">Active in Kathmandu Hub</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">In Counselling & Review</span>
            <div className="metric-icon-wrap amber">
              <BookOpen size={17} />
            </div>
          </div>
          <div className="metric-value">
            {students.filter(s => s.status === "COUNSELLING" || s.status === "NEW_LEAD").length}
          </div>
          <span className="metric-sub">Profile scrutiny & course choice</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Applications & Offers</span>
            <div className="metric-icon-wrap purple">
              <FileText size={17} />
            </div>
          </div>
          <div className="metric-value">
            {students.filter(s => s.status === "APPLICATION_SUBMITTED" || s.status === "OFFER_RECEIVED").length}
          </div>
          <span className="metric-sub">Offers & CAS / I-20 tracking</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Visa Processing & Enrolled</span>
            <div className="metric-icon-wrap green">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="metric-value">
            {students.filter(s => s.status === "VISA_PROCESSING" || s.status === "ENROLLED").length}
          </div>
          <span className="metric-sub">Embassy visa clearances</span>
        </div>
      </div>

      {/* Main Panel */}
      <div className="crm-panel student-directory-panel">
        {/* Filter Toolbar */}
        <div className="filter-toolbar student-directory-toolbar">
          <div className="search-input-wrap student-directory-search">
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search candidate name, AECS code, phone, course…"
            />
          </div>

          <div className="toolbar-selects">
            <select
              className="crm-select"
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
            >
              <option value="ALL">All Authorized Destinations ({AECS_AUTHORIZED_COUNTRIES.length})</option>
              {AECS_AUTHORIZED_COUNTRIES.map(c => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              className="crm-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Stages</option>
              <option value="NEW_LEAD">1. New Inquiry</option>
              <option value="COUNSELLING">2. In Counselling</option>
              <option value="APPLICATION_SUBMITTED">3. App Submitted</option>
              <option value="OFFER_RECEIVED">4. Offer Received</option>
              <option value="VISA_PROCESSING">5. Visa Lodged</option>
              <option value="ENROLLED">6. Enrolled</option>
            </select>

            {/* View Switcher */}
            <div className="view-toggle-group">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
              >
                <TableIcon size={14} />
                <span>Table</span>
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === "kanban" ? "active" : ""}`}
                onClick={() => setViewMode("kanban")}
              >
                <Kanban size={14} />
                <span>Pipeline</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter Stage Badges Strip */}
        <div className="student-stage-filters">
          <button
            type="button"
            className={`coa-category-pill ${statusFilter === "ALL" ? "active" : ""}`}
            onClick={() => setStatusFilter("ALL")}
          >
            All Candidates ({students.length})
          </button>
          {KANBAN_STAGES.map(stage => {
            const count = students.filter(s => s.status === stage).length;
            return (
              <button
                key={stage}
                type="button"
                className={`coa-category-pill ${statusFilter === stage ? "active" : ""}`}
                onClick={() => setStatusFilter(statusFilter === stage ? "ALL" : stage)}
              >
                <span>{STAGE_CONFIG[stage].label}</span>
                <span className="code-font" style={{ opacity: 0.8 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* VIEW 1: HIGH-DENSITY PROFESSIONAL DATA TABLE */}
        {viewMode === "table" && (
          <div className="table-wrapper student-directory-table-wrap">
            <table className="crm-table student-directory-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Destination & Course</th>
                  <th>English & Academics</th>
                  <th>Lifecycle Stage</th>
                  <th>Documents</th>
                  <th>Assigned Counsellor</th>
                  <th style={{ textAlign: "right", width: "120px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(std => {
                  const initials = std.fullName
                    .split(" ")
                    .map(n => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const countryCode = countryCodeFor(std.targetCountry);

                  return (
                    <tr
                      key={std.id}
                      onClick={() => setActiveStudent(std)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div className="student-directory-identity">
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: "var(--primary-navy)",
                              color: "#FFFFFF",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11.5px",
                              fontWeight: 700,
                              flexShrink: 0,
                              overflow: "hidden",
                            }}
                          >
                            {studentPhotoUrls[std.code]
                              ? <img src={studentPhotoUrls[std.code]} alt="" style={{width:"100%",height:"100%",display:"block",objectFit:"cover"}} />
                              : initials}
                          </div>
                          <div className="student-name-cell">
                            <strong style={{ fontSize: "13px" }}>{std.fullName}</strong>
                            <span className="account-code-cell">{std.code}</span>
                            <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                              {std.phone} · {std.email}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {countryCode ? <CountryFlag code={countryCode} size={17}/> : <span className="student-country-fallback">🌐</span>}
                          <div>
                            <strong>{std.targetCountry}</strong>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>
                              {std.targetCourse}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: "12px", display: "block" }}>
                            {std.englishTest.test}
                          </span>
                          <small style={{ color: "var(--text-muted)", fontSize: "10.5px" }}>
                            {std.englishTest.score}
                          </small>
                        </div>
                      </td>

                      <td>
                        <span className={`badge-status ${STAGE_CONFIG[std.status].tone}`}>
                          {STAGE_CONFIG[std.status].label}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "48px",
                              height: "5px",
                              borderRadius: "99px",
                              background: "var(--bg-card-subtle)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${(std.documentsVerified / std.documentsTotal) * 100}%`,
                                height: "100%",
                                background: std.documentsVerified === 10 ? "var(--success)" : "var(--accent-blue)",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: 700 }}>
                            {std.documentsVerified}/{std.documentsTotal}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <UserCheck size={14} style={{ color: "var(--accent-blue)" }} />
                          <span style={{ fontSize: "12px", color: "var(--text-main)", fontWeight: 500 }}>
                            {std.counsellor}
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="table-actions" style={{ justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                          <a
                            href={`https://wa.me/${std.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="table-btn"
                            title="Chat on WhatsApp"
                            style={{ color: "#10B981" }}
                          >
                            <MessageCircle size={14} />
                          </a>
                          <button
                            type="button"
                            className="table-btn"
                            title="View Full Profile Inspector"
                            onClick={() => setActiveStudent(std)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="table-btn"
                            title="Archive Record"
                            onClick={() => handleDelete(std.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 2: HIGH-FIDELITY KANBAN PIPELINE BOARD */}
        {viewMode === "kanban" && (
          <div className="pipeline-board">
            {KANBAN_STAGES.map(stage => {
              const stageStudents = filteredStudents.filter(s => s.status === stage);
              return (
                <div key={stage} className="pipeline-column">
                  <div className="pipeline-col-header">
                    <strong>{STAGE_CONFIG[stage].colName}</strong>
                    <span className="col-count">{stageStudents.length}</span>
                  </div>

                  <div className="pipeline-cards-list">
                    {stageStudents.map(std => {
                      const countryCode = countryCodeFor(std.targetCountry);
                      return (
                        <div
                          key={std.id}
                          className="pipeline-card"
                          onClick={() => setActiveStudent(std)}
                        >
                          <div className="pcard-header">
                            <span className="pcard-code">{std.code}</span>
                            <span className="pcard-country">
                              {countryCode ? <CountryFlag code={countryCode} size={14}/> : <span>🌐</span>} {std.targetCountry}
                            </span>
                          </div>

                          <div className="pcard-name">{std.fullName}</div>
                          <div className="pcard-course">{std.targetCourse}</div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              margin: "6px 0",
                              fontSize: "10.5px",
                              color: "var(--text-muted)",
                            }}
                          >
                            <span>{std.englishTest.test}</span>
                            <strong style={{ color: "var(--accent-blue)" }}>{std.documentsVerified}/10 Docs</strong>
                          </div>

                          <div className="pcard-footer">
                            <span>{std.counsellor}</span>
                            {stage !== "ENROLLED" && (
                              <button
                                type="button"
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--accent-blue)",
                                  fontSize: "10.5px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "2px",
                                }}
                                onClick={e => {
                                  e.stopPropagation();
                                  handleAdvanceStage(std);
                                }}
                              >
                                <span>Advance</span>
                                <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {stageStudents.length === 0 && (
                      <div style={{ textAlign: "center", padding: "28px 10px", color: "var(--text-muted)", fontSize: "11.5px" }}>
                        No candidate in this stage
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MULTI-TAB SLIDE-OVER STUDENT INSPECTOR DRAWER */}
      {activeStudent && (
        <div className="drawer-overlay" onClick={() => setActiveStudent(null)}>
          <div className={`slide-over-panel ${inspectorTab==="docs"?"student-documents-drawer":""}`} style={{ width: inspectorTab==="docs"?"min(780px, 100%)":"min(620px, 100%)" }} onClick={e => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="drawer-header">
              <div className="student-profile-photo-wrap">
                <div className="student-profile-photo">
                  {studentPhotoUrl ? <img src={studentPhotoUrl} alt={`${activeStudent.fullName} profile`} /> : <span>{activeStudent.fullName.slice(0, 2).toUpperCase()}</span>}
                </div>
                <button type="button" onClick={()=>photoInputRef.current?.click()} disabled={photoUploading} aria-label={studentPhotoUrl?"Change student photo":"Upload student photo"} title={studentPhotoUrl?"Change student photo":"Upload student photo"}>
                  <Camera size={13}/>
                </button>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={event=>void handleStudentPhotoUpload(event.target.files?.[0])}/>
              </div>
              <div className="drawer-header-info">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span className="account-code-cell" style={{ fontSize: "13px" }}>{activeStudent.code}</span>
                  <span className={`badge-status ${STAGE_CONFIG[activeStudent.status].tone}`}>
                    {STAGE_CONFIG[activeStudent.status].label}
                  </span>
                </div>
                <strong>{activeStudent.fullName}</strong>
                <span>Registered {activeStudent.createdAt} · Assigned to {activeStudent.counsellor}</span>
              </div>
              <div className="student-drawer-actions">
                <button type="button" className="btn-secondary" onClick={() => beginStudentEdit(activeStudent)}>
                  <Edit3 size={15} /><span>Edit student</span>
                </button>
                <button type="button" className="drawer-close-btn" onClick={() => setActiveStudent(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Inspector Navigation Tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--border-subtle)",
                background: "var(--bg-card-subtle)",
                padding: "0 18px",
              }}
            >
              {[
                { key: "profile", label: "Profile & Identity", icon: Users },
                { key: "academic", label: "Academics & Tests", icon: GraduationCap },
                { key: "docs", label: "Documents", icon: FileCheck2 },
                { key: "notes", label: "Counselling Notes", icon: MessageSquare },
              ].map(tab => {
                const Icon = tab.icon;
                const active = inspectorTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "11px 14px",
                      fontSize: "12px",
                      fontWeight: active ? 700 : 500,
                      color: active ? "var(--accent-blue)" : "var(--text-muted)",
                      borderBottom: active ? "2px solid var(--accent-blue)" : "2px solid transparent",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => setInspectorTab(tab.key as any)}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Inspector Body */}
            <div className="drawer-content">
              {inspectorTab === "profile" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <h4 className="drawer-section-title">
                      <Users size={15} />
                      <span>Contact & Identification</span>
                    </h4>
                    <div className="drawer-data-grid">
                      <div className="data-item">
                        <label>Email Address</label>
                        <span>{activeStudent.email}</span>
                      </div>
                      <div className="data-item">
                        <label>WhatsApp Phone</label>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>{activeStudent.phone}</span>
                          <a
                            href={`https://wa.me/${activeStudent.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#10B981" }}
                          >
                            <MessageCircle size={14} />
                          </a>
                        </div>
                      </div>
                      <div className="data-item">
                        <label>Date of Birth</label>
                        <span>{activeStudent.dob}</span>
                      </div>
                      <div className="data-item">
                        <label>Gender</label>
                        <span>{activeStudent.gender}</span>
                      </div>
                      <div className="data-item" style={{ gridColumn: "1 / -1" }}>
                        <label>Current Address</label>
                        <span>{activeStudent.address}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="drawer-section-title">
                      <PlaneTakeoff size={15} />
                      <span>Study Abroad Target</span>
                    </h4>
                    <div className="drawer-data-grid">
                      <div className="data-item">
                        <label>Primary Destination</label>
                        <span className="student-destination-with-flag">{countryCodeFor(activeStudent.targetCountry)?<CountryFlag code={countryCodeFor(activeStudent.targetCountry)} size={16}/>:<span>🌐</span>} {activeStudent.targetCountry}</span>
                      </div>
                      <div className="data-item">
                        <label>Intake Target</label>
                        <span>{activeStudent.targetIntake}</span>
                      </div>
                      <div className="data-item" style={{ gridColumn: "1 / -1" }}>
                        <label>Degree Course</label>
                        <span>{activeStudent.targetCourse}</span>
                      </div>
                      <div className="data-item">
                        <label>Estimated Annual Budget</label>
                        <span>{activeStudent.budget}</span>
                      </div>
                      <div className="data-item">
                        <label>Assigned Officer</label>
                        <span>{activeStudent.counsellor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === "academic" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <h4 className="drawer-section-title">
                      <GraduationCap size={15} />
                      <span>Academic Background</span>
                    </h4>
                    <p style={{ padding: "12px 16px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", fontSize: "12.5px" }}>
                      {activeStudent.academicSummary}
                    </p>
                  </div>

                  <div>
                    <h4 className="drawer-section-title">
                      <Award size={15} />
                      <span>English Language Proficiency</span>
                    </h4>
                    <div style={{ padding: "14px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)" }}>
                      <strong style={{ fontSize: "14px", color: "var(--accent-blue)", display: "block", marginBottom: "4px" }}>
                        {activeStudent.englishTest.test}
                      </strong>
                      <span style={{ fontSize: "12.5px", color: "var(--text-main)" }}>
                        {activeStudent.englishTest.score}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === "docs" && (
                <div className="student-document-workspace">
                  <div className="student-document-heading">
                    <div><span className="student-document-eyebrow">Private student vault</span><h4><FileCheck2 size={17}/>Documents & scrutiny</h4><p>Upload and review official documents for {activeStudent.fullName}.</p></div>
                    <div className="student-document-heading-actions"><button type="button" className="btn-secondary" onClick={()=>navigate("/documents")}><FileText size={15}/>Open vault</button><button type="button" className="btn-primary" onClick={()=>setShowDocumentUpload(true)}><UploadCloud size={15}/>Upload documents</button></div>
                  </div>

                  <div className="student-document-summary">
                    <div><strong>{studentDocuments.length}</strong><span>Uploaded</span></div>
                    <div><strong>{studentDocuments.filter(document=>document.status==="VERIFIED").length}</strong><span>Verified</span></div>
                    <div><strong>{studentDocuments.filter(document=>document.status==="UNDER_REVIEW").length}</strong><span>Under review</span></div>
                  </div>

                  {documentError&&<div className="student-document-error"><AlertCircle size={15}/>{documentError}</div>}
                  {documentsLoading?<div className="student-document-empty">Loading private documents…</div>:studentDocuments.length===0?<div className="student-document-empty"><FileText size={28}/><strong>No documents uploaded</strong><span>Use Upload document to start this student's verified document vault.</span></div>:<div className="student-document-list">{studentDocuments.map(document=><article key={document.id}>
                    <div className="student-document-file-icon"><FileText size={19}/></div><div className="student-document-file-info"><strong>{document.fileName}</strong><span>{document.category} · {document.fileSize} · Version {document.version}</span><small>Uploaded {document.uploadedAt}{document.expiresOn?` · Expires ${document.expiresOn}`:""}</small></div>
                    <span className={`student-document-status is-${document.status.toLowerCase().replace('_','-')}`}>{document.status.replace('_',' ')}</span>
                    <div className="student-document-actions"><button type="button" onClick={()=>void openStudentDocument(document)} title="View document"><Eye size={15}/></button><button type="button" onClick={()=>void openStudentDocument(document,true)} title="Download document"><Download size={15}/></button></div>
                  </article>)}</div>}
                </div>
              )}

              {inspectorTab === "notes" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <h4 className="drawer-section-title">
                      <MessageSquare size={15} />
                      <span>Add Consultation Remark</span>
                    </h4>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        value={newInspectorNote}
                        onChange={e => setNewInspectorNote(e.target.value)}
                        placeholder="Log counselling note, phone call, or university update…"
                        style={{
                          flex: 1,
                          height: "38px",
                          padding: "0 12px",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--bg-input)",
                          fontSize: "12.5px",
                        }}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleAddNoteToActiveStudent}
                      >
                        <span>Add Note</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="drawer-section-title">
                      <Clock size={15} />
                      <span>Interaction Audit Trail</span>
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {activeStudent.notes.map((n, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "10px 14px",
                            background: "var(--bg-card-subtle)",
                            borderLeft: "3px solid var(--accent-blue)",
                            borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
                            fontSize: "12px",
                            lineHeight: "1.45",
                          }}
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDocumentUpload && activeStudent && (
        <div className="modal-backdrop-clean student-document-modal-backdrop" onClick={()=>setShowDocumentUpload(false)}>
          <div className="modal-dialog-clean student-document-upload-dialog" onClick={event=>event.stopPropagation()}>
            <div className="student-document-modal-header"><div><span>Secure student vault</span><h3>Upload supporting documents</h3><p>{activeStudent.fullName} · {activeStudent.code}</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowDocumentUpload(false)}><X size={18}/></button></div>
            <form className="student-document-upload" onSubmit={uploadStudentDocument}>
              <section className="student-document-upload-stage"><header><b>1</b><div><strong>Select files</strong><span>Choose multiple PDF, JPG, PNG, or DOCX files · 1 MB per file · 20 MB total.</span></div></header><div className="student-document-dropzone"><UploadCloud size={28}/><strong>{documentFiles.length?`${documentFiles.length} document${documentFiles.length===1?"":"s"} selected`:"Drop files here or browse"}</strong><span>Files stay private and are linked only to this student.</span><input type="file" multiple required accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event=>{const files=Array.from(event.target.files??[]);event.currentTarget.value="";if(files.length>15){notifyError("Too many documents","Select a maximum of 15 documents per upload batch.");return}if(!validateDocumentFiles(files))return;setDocumentError("");setDocumentFiles(files)}}/></div>
              {documentFiles.length>0&&<div className="student-document-queue">{documentFiles.map((file,index)=><div key={`${file.name}-${file.lastModified}`}><span>{index+1}</span><strong>{file.name}</strong><small>{file.size<1048576?`${Math.ceil(file.size/1024)} KB`:`${(file.size/1048576).toFixed(1)} MB`}</small><button type="button" aria-label={`Remove ${file.name}`} onClick={()=>setDocumentFiles(documentFiles.filter((_,position)=>position!==index))}><X size={13}/></button></div>)}</div>}</section>
              <section className="student-document-upload-stage"><header><b>2</b><div><strong>Classify and submit</strong><span>Apply these scrutiny details to the selected upload batch.</span></div></header><div className="student-document-form-grid"><label>Document category<select value={documentForm.category} onChange={e=>setDocumentForm({...documentForm,category:e.target.value})}><option>Passport & Identity</option><option>Academic Transcripts</option><option>English Test Results</option><option>Financial Documents</option><option>Visa & Embassy Files</option><option>Recommendation Letters</option><option>Others</option></select></label><label>Expiry date (optional)<input type="date" value={documentForm.expiresOn} onChange={e=>setDocumentForm({...documentForm,expiresOn:e.target.value})}/></label><label className="student-document-wide">Internal review note (optional)<textarea value={documentForm.notes} onChange={e=>setDocumentForm({...documentForm,notes:e.target.value})} placeholder="Add validity, translation, or scrutiny notes…"/></label></div></section>
              {documentError&&<div className="student-document-error"><AlertCircle size={15}/>{documentError}</div>}
              <div className="student-document-modal-footer"><div><ShieldCheck size={16}/><span>Encrypted private storage · audit logged</span></div><button type="button" className="btn-secondary" onClick={()=>setShowDocumentUpload(false)}>Cancel</button><button className="btn-primary" type="submit" disabled={documentSaving||documentFiles.length===0}>{documentSaving?`Uploading ${documentFiles.length}…`:`Upload ${documentFiles.length||""} document${documentFiles.length===1?"":"s"}`}</button></div>
            </form>
          </div>
        </div>
      )}

      {editingStudent && editForm && (
        <div className="modal-backdrop-clean" onClick={() => setEditingStudent(null)}>
          <div className="modal-dialog-clean student-edit-dialog" onClick={event => event.stopPropagation()}>
            <div className="modal-header-clean">
              <div><small>Complete student record management</small><h3>Edit {editingStudent.fullName}</h3><p>Update identity, academics, study preferences, test results, and passport status.</p></div>
              <button type="button" className="drawer-close-btn" onClick={() => setEditingStudent(null)}><X size={18}/></button>
            </div>
            <form onSubmit={saveStudentEdit}>
              <nav className="student-edit-nav" aria-label="Student information sections">
                {([
                  ["identity","Identity & contact"], ["academics","Academics"],
                  ["study","Study plan"], ["tests","Tests & compliance"],
                ] as const).map(([key,label])=><button key={key} type="button" className={editorSection===key?"is-active":""} onClick={()=>setEditorSection(key)}>{label}</button>)}
              </nav>
              <div className="student-edit-body">
                {editorSection==="identity"&&<fieldset><legend>Identity & contact</legend><p className="student-edit-section-copy">Official identity and direct contact information used across the CRM.</p><div className="student-edit-grid">
                  <label>Full name *<input required value={editForm.fullName} onChange={e=>setEditForm({...editForm,fullName:e.target.value})}/></label>
                  <label>Email *<input required type="email" value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})}/></label>
                  <label>WhatsApp / mobile *<input required value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})}/></label>
                  <label>Date of birth *<input required type="date" value={editForm.dob} onChange={e=>setEditForm({...editForm,dob:e.target.value})}/></label>
                  <label>Gender *<select value={editForm.gender} onChange={e=>setEditForm({...editForm,gender:e.target.value as StudentPayload["gender"]})}><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label>
                  <label>Current address<input value={editForm.address??""} onChange={e=>setEditForm({...editForm,address:e.target.value})}/></label>
                </div></fieldset>}
                {editorSection==="academics"&&<fieldset><legend>Academic background</legend><p className="student-edit-section-copy">Record the latest verified education history and any study gap.</p><div className="student-edit-grid">
                  <label>Highest qualification<input value={editForm.highestQualification??""} onChange={e=>setEditForm({...editForm,highestQualification:e.target.value})}/></label>
                  <label>Institution / academic status<input value={editForm.academicStatus??""} onChange={e=>setEditForm({...editForm,academicStatus:e.target.value})}/></label>
                  <label>Latest GPA / percentage<input value={editForm.latestResult??""} onChange={e=>setEditForm({...editForm,latestResult:e.target.value})}/></label>
                  <label>Study gap<input value={editForm.studyGap??""} onChange={e=>setEditForm({...editForm,studyGap:e.target.value})}/></label>
                  <label className="student-edit-wide">Gap explanation / employment status<textarea value={editForm.employmentStatus??""} onChange={e=>setEditForm({...editForm,employmentStatus:e.target.value})}/></label>
                </div></fieldset>}
                {editorSection==="study"&&<fieldset><legend>Study preferences</legend><p className="student-edit-section-copy">Maintain the candidate's current destination, program, intake, and budget plan.</p><div className="student-edit-grid">
                  <label>Primary destination<select value={editForm.targetCountry} onChange={e=>setEditForm({...editForm,targetCountry:e.target.value})}><option value="">Select country</option>{AECS_AUTHORIZED_COUNTRIES.map(country=><option key={country.name} value={country.name}>{country.name}</option>)}</select></label>
                  <label>Secondary destination<input value={editForm.secondCountry??""} onChange={e=>setEditForm({...editForm,secondCountry:e.target.value})}/></label>
                  <label>Course / program<input value={editForm.targetCourse} onChange={e=>setEditForm({...editForm,targetCourse:e.target.value})}/></label>
                  <label>Target intake<input value={editForm.targetIntake??""} onChange={e=>setEditForm({...editForm,targetIntake:e.target.value})}/></label>
                  <label>Budget (NPR)<input inputMode="numeric" value={editForm.budget??""} onChange={e=>setEditForm({...editForm,budget:e.target.value})}/></label>
                </div></fieldset>}
                {editorSection==="tests"&&<fieldset><legend>English test & compliance</legend><p className="student-edit-section-copy">Choose the test status first. A completed test requires both its type and overall score.</p><div className="student-edit-grid">
                  <label>English test status<select value={editForm.testTaken?"TAKEN":"NOT_TAKEN"} onChange={e=>setEditForm({...editForm,testTaken:e.target.value==="TAKEN",testType:e.target.value==="TAKEN"?editForm.testType:"",testScore:e.target.value==="TAKEN"?editForm.testScore:""})}><option value="NOT_TAKEN">Not taken</option><option value="TAKEN">Taken — score available</option></select></label>
                  <label>Test type<select disabled={!editForm.testTaken} required={editForm.testTaken} value={editForm.testType??""} onChange={e=>setEditForm({...editForm,testType:e.target.value})}><option value="">Select test</option><option value="IELTS">IELTS</option><option value="PTE">PTE Academic</option><option value="Duolingo">Duolingo (DET)</option><option value="TOEFL">TOEFL</option><option value="GRE">GRE</option><option value="SAT">SAT</option></select></label>
                  <label>Overall score<input disabled={!editForm.testTaken} value={editForm.testScore??""} onChange={e=>setEditForm({...editForm,testScore:e.target.value})}/></label>
                  <label className="student-edit-check"><input type="checkbox" checked={Boolean(editForm.hasPassport)} onChange={e=>setEditForm({...editForm,hasPassport:e.target.checked})}/> Valid passport available</label>
                  <label>Lead source<input value={editForm.leadSource??""} onChange={e=>setEditForm({...editForm,leadSource:e.target.value})}/></label>
                  <label className="student-edit-wide">Registration note<textarea value={editForm.message??""} onChange={e=>setEditForm({...editForm,message:e.target.value})}/></label>
                </div></fieldset>}
              </div>
              <div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setEditingStudent(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={isUpdatingStudent}>{isUpdatingStudent?"Saving…":"Save all changes"}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD LEAD MODAL */}
      {showAddModal && (
        <div className="modal-backdrop-clean" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog-clean" onClick={e => e.stopPropagation()}>
            <div className="modal-header-clean">
              <div>
                <h3>Register Quick Student Lead</h3>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  Create an intake case in the AECS Bagbazar operations database
                </p>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddLead}>
              <div className="modal-body-clean">
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Candidate Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newLeadForm.fullName}
                      onChange={e => setNewLeadForm({ ...newLeadForm, fullName: e.target.value })}
                      placeholder="e.g. Riya Sharma"
                    />
                  </div>
                  <div className="form-group">
                    <label>Gender *</label>
                    <select
                      value={newLeadForm.gender}
                      onChange={e => setNewLeadForm({ ...newLeadForm, gender: e.target.value as any })}
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      required
                      value={newLeadForm.email}
                      onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                      placeholder="student@example.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>WhatsApp Phone *</label>
                    <input
                      type="tel"
                      required
                      value={newLeadForm.phone}
                      onChange={e => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                      placeholder="+977 98XXXXXXXX"
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Target Destination *</label>
                    <select
                      value={newLeadForm.targetCountry}
                      onChange={e => setNewLeadForm({ ...newLeadForm, targetCountry: e.target.value })}
                    >
                      <option value="UK">🇬🇧 United Kingdom</option>
                      <option value="Australia">🇦🇺 Australia</option>
                      <option value="Canada">🇨🇦 Canada</option>
                      <option value="USA">🇺🇸 United States</option>
                      <option value="Germany">🇩🇪 Germany</option>
                      <option value="Japan">🇯🇵 Japan</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Assigned Lead Counsellor</label>
                    <select
                      value={newLeadForm.counsellor}
                      onChange={e => setNewLeadForm({ ...newLeadForm, counsellor: e.target.value })}
                    >
                      <option value="Unassigned">Unassigned</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Target Degree / Course</label>
                  <input
                    type="text"
                    value={newLeadForm.targetCourse}
                    onChange={e => setNewLeadForm({ ...newLeadForm, targetCourse: e.target.value })}
                    placeholder="e.g. MSc International Business"
                  />
                </div>
              </div>

              <div className="modal-footer-clean">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <UserPlus size={15} />
                  <span>Create Lead Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDirectory;
