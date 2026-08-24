import { useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  PieChart as PieChartIcon,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { BLUEPRINT_50_REPORTS, type CoreReport } from "../../lib/blueprintReportsData";

const REPORT_CATEGORIES = [
  "All Categories",
  "Daily Management",
  "HR and Staff",
  "Leads and Counselling",
  "Students and Applications",
  "Documents and Visa",
  "Booking and Academic",
  "Finance and Accounting",
  "Management and Audit",
] as const;

export function AnalyticsDashboard() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"reports" | "funnel">("reports");

  // Report Modal Preview State
  const [selectedReport, setSelectedReport] = useState<CoreReport | null>(null);

  const filteredReports = BLUEPRINT_50_REPORTS.filter(report => {
    const matchesCat = selectedCategory === "All Categories" || report.category === selectedCategory;
    const matchesRole = roleFilter === "ALL" || report.primaryRoles.some(r => r.toLowerCase().includes(roleFilter.toLowerCase()));
    const matchesSearch =
      report.heading.toLowerCase().includes(search.toLowerCase()) ||
      report.description.toLowerCase().includes(search.toLowerCase()) ||
      report.id.toString().includes(search);
    return matchesCat && matchesRole && matchesSearch;
  });

  const exportIndexCSV = () => {
    const headers = ["Report No,Category,Report Heading,Primary Assigned Roles,Operational Purpose\n"];
    const rows = BLUEPRINT_50_REPORTS.map(
      r => `"#${r.id}","${r.category}","${r.heading}","${r.primaryRoles.join("; ")}","${r.description.replace(/"/g, '""')}"\n`
    );
    const blob = new Blob([...headers, ...rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AECS_50_Core_Reports_Master_Index_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container">
      {/* Header Row */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>Analytics & Core Reports</h2>
          <p>
            Operational conversion funnels and master directory of 50 blueprint consultancy CRM reports.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={exportIndexCSV}
            title="Export 50 Blueprint Reports Master Index to CSV"
          >
            <Download size={15} />
            <span>Export Report Index (CSV)</span>
          </button>
        </div>
      </div>

      {/* Flagship Metric Strip */}
      <div className="metrics-grid-4">
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Lead Conversion SLA</span>
            <div className="metric-icon-wrap blue">
              <TrendingUp size={17} />
            </div>
          </div>
          <div className="metric-value">34.8%</div>
          <span className="metric-sub">Inquiry to offer letter rate</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Visa Grant Success</span>
            <div className="metric-icon-wrap green">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="metric-value">96.2%</div>
          <span className="metric-sub">UK, Aus, Canada & USA cohorts</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Academic Score Outcome</span>
            <div className="metric-icon-wrap amber">
              <BookOpen size={17} />
            </div>
          </div>
          <div className="metric-value">7.0 / 72</div>
          <span className="metric-sub">IELTS Band 7.0+ · PTE 72+ avg</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Standard Core Reports</span>
            <div className="metric-icon-wrap purple">
              <FileSpreadsheet size={17} />
            </div>
          </div>
          <div className="metric-value">50 / 50</div>
          <span className="metric-sub">Master Blueprint Catalog</span>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="document-tabs">
        <button
          className={activeTab === "reports" ? "active" : ""}
          onClick={() => setActiveTab("reports")}
        >
          <FileSpreadsheet size={16} />
          <span>50 Core Reports Directory</span>
        </button>
        <button
          className={activeTab === "funnel" ? "active" : ""}
          onClick={() => setActiveTab("funnel")}
        >
          <BarChart3 size={16} />
          <span>Student Lifecycle Conversion Funnel</span>
        </button>
      </div>

      {activeTab === "reports" ? (
        <div className="crm-panel">
          <div className="filter-toolbar">
            <div className="search-input-wrap" style={{ width: "360px" }}>
              <Search size={16} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by report heading, number (#1–50), or metric…"
              />
            </div>

            <div className="toolbar-selects">
              <select
                className="crm-select"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                {REPORT_CATEGORIES.map(cat => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>

              <select
                className="crm-select"
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
              >
                <option value="ALL">All Authorized Roles</option>
                <option value="Owner">Owner / Director</option>
                <option value="Operations">Operations Manager</option>
                <option value="Counselor">Counsellor</option>
                <option value="Finance">Finance Officer</option>
                <option value="Visa">Visa Officer</option>
                <option value="HR">HR Administrator</option>
                <option value="Auditor">Auditor</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: "70px" }}>No.</th>
                  <th>Category</th>
                  <th>Report Heading</th>
                  <th>Primary Assigned Roles</th>
                  <th>Operational Purpose & Metric Coverage</th>
                  <th style={{ textAlign: "right", width: "110px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(rep => (
                  <tr
                    key={rep.id}
                    onClick={() => setSelectedReport(rep)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span className="account-code-cell">
                        #{rep.id < 10 ? `0${rep.id}` : rep.id}
                      </span>
                    </td>

                    <td>
                      <span className="badge-status application">
                        {rep.category}
                      </span>
                    </td>

                    <td>
                      <strong style={{ fontSize: "13px", color: "var(--text-main)" }}>
                        {rep.heading}
                      </strong>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {rep.primaryRoles.map(role => (
                          <span
                            key={role}
                            style={{
                              fontSize: "11px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "var(--bg-card-subtle)",
                              border: "1px solid var(--border-subtle)",
                              color: "var(--text-main)",
                              fontWeight: 500,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.45" }}>
                        {rep.description}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: "3px 8px", fontSize: "11px" }}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedReport(rep);
                        }}
                      >
                        <Eye size={13} />
                        <span>Preview</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB 2: CONVERSION FUNNEL */
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>AECS Student Admission & Visa Funnel</h3>
              <p>Standard six-stage conversion pipeline for education consultancy operations</p>
            </div>
            <span className="status-pill">
              <Calendar size={13} style={{ color: "var(--accent-blue)" }} />
              <span>Fiscal Year 2026/27</span>
            </span>
          </div>

          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { stage: "Stage 1", label: "Initial Lead / Desk Inquiry", count: "1,200 leads", pct: 100, barClass: "#F97316", note: "Walk-ins, social ads & education fair leads" },
              { stage: "Stage 2", label: "Desk Counselling Completed", count: "822 Consultations", pct: 68.5, barClass: "#FB923C", note: "1-on-1 career guidance & destination shortlisting" },
              { stage: "Stage 3", label: "Test Prep & Documents Verified", count: "612 Student Files", pct: 51.0, barClass: "#FDBA74", note: "IELTS/PTE batch enrollment & 10-point checklist" },
              { stage: "Stage 4", label: "University Application Submitted", count: "530 Applications", pct: 44.2, barClass: "#10B981", note: "Submitted to UK, Aus, Canada, US institutions" },
              { stage: "Stage 5", label: "Offer Letter & CAS / I-20 Received", count: "462 Confirmed Offers", pct: 38.5, barClass: "#059669", note: "Unconditional offers & financial deposit confirmed" },
              { stage: "Stage 6", label: "Visa Lodged & Approved", count: "418 Final Enrolments", pct: 34.8, barClass: "#047857", note: "Full visa grants with 96.2% statutory success" },
            ].map(item => (
              <div
                key={item.stage}
                style={{
                  padding: "16px 20px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-card-subtle)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="account-code-cell">{item.stage}</span>
                    <strong style={{ fontSize: "13.5px", color: "var(--text-main)" }}>{item.label}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.count}</span>
                    <strong className="code-font" style={{ fontSize: "14px", color: "var(--accent-blue)" }}>{item.pct}%</strong>
                  </div>
                </div>

                <div
                  style={{
                    height: "8px",
                    borderRadius: "99px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${item.pct}%`,
                      background: item.barClass,
                      borderRadius: "99px",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>

                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INTERACTIVE REPORT PREVIEW MODAL */}
      {selectedReport && (
        <div className="modal-backdrop-clean" onClick={() => setSelectedReport(null)}>
          <div
            className="modal-dialog-clean"
            style={{ maxWidth: "680px" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header-clean">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span className="account-code-cell" style={{ fontSize: "13px" }}>
                    Report #{selectedReport.id < 10 ? `0${selectedReport.id}` : selectedReport.id}
                  </span>
                  <span className="badge-status application">{selectedReport.category}</span>
                </div>
                <h3>{selectedReport.heading}</h3>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setSelectedReport(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-clean" style={{ gap: "16px" }}>
              <div style={{ padding: "12px 14px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", fontSize: "12.5px" }}>
                <strong style={{ display: "block", marginBottom: "4px", color: "var(--text-main)" }}>Operational Purpose:</strong>
                <span style={{ color: "var(--text-muted)", lineHeight: "1.45" }}>{selectedReport.description}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11.5px" }}>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Authorized Roles:</span>
                  <strong>{selectedReport.primaryRoles.join(", ")}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Data Source:</span>
                  <strong className="code-font">PostgreSQL · AECS Bagbazar Main Office</strong>
                </div>
              </div>

              {/* Sample Live Output Preview Table */}
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-card-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Metric Key</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Target Destination</th>
                      <th style={{ padding: "8px 12px", textAlign: "center" }}>Period Volume</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Compliance Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "8px 12px" }}><strong>Lead Intake Volume</strong></td>
                      <td style={{ padding: "8px 12px" }}>United Kingdom</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}><span className="code-font">48 Leads</span></td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}><span className="badge-status enrolled">98% On Target</span></td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "8px 12px" }}><strong>Application Conversions</strong></td>
                      <td style={{ padding: "8px 12px" }}>Australia</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}><span className="code-font">28 Lodged</span></td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}><span className="badge-status enrolled">SLA Verified</span></td>
                    </tr>
                    <tr>
                      <td style={{ padding: "8px 12px" }}><strong>Financial Fee Reconciliation</strong></td>
                      <td style={{ padding: "8px 12px" }}>Canada & USA</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}><span className="code-font">₨ 8.42 Lakhs</span></td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}><span className="badge-status offer">Reconciled</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer-clean">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedReport(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  alert(`Exporting Report #${selectedReport.id}: "${selectedReport.heading}" to Excel/CSV.`);
                }}
              >
                <Download size={15} />
                <span>Export Report Data (CSV)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsDashboard;
