import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  Camera,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { HrmsService } from "../../services/hrmsService";
import {
  EmployeeMonthlyReportService,
  type EmployeeMonthlyReport as ReportData,
  type EmployeeMonthlyReportRow,
} from "../../services/employeeMonthlyReportService";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const ratio = (done: number, total: number) => total ? Math.round((done / total) * 100) : 0;
const safeFileMonth = (month: string) => month.replace("-", "_");
const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

function downloadBlob(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function scoreTone(score: number) {
  if (score >= 80) return "strong";
  if (score >= 60) return "stable";
  return "focus";
}

function shortDate(value: string) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
}

function stageLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function ContributionDetail({ row, type, month }: { row: EmployeeMonthlyReportRow; type: "leads" | "conversions" | "applications"; month: string }) {
  const leads = type === "conversions" ? row.leadDetails.filter(item => item.stage === "CONVERTED") : row.leadDetails;
  const applications = row.applicationDetails;
  const records = type === "applications" ? applications : leads;
  const title = type === "leads" ? "Assigned leads" : type === "conversions" ? "Converted leads" : "Applications handled";
  return <span className="employee-contribution-popover" role="tooltip">
    <header><div><strong>{row.fullName} · {title}</strong><small>{records.length} monthly {records.length === 1 ? "record" : "records"}</small></div><em>{monthLabel(month)}</em></header>
    <div className="employee-contribution-records">
      {type === "applications" ? applications.map(item => <article key={item.id}><span className="record-avatar app">A</span><div><strong>{item.university}</strong><small>{item.course} · {item.country}</small><em>{stageLabel(item.stage)} · {shortDate(item.createdAt)}</em></div></article>) : leads.map(item => <article key={item.id}><span className="record-avatar">{item.name.slice(0, 1).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.code} · {item.country}</small><em>{stageLabel(item.stage)} · {shortDate(item.createdAt)}</em></div></article>)}
      {!records.length && <div className="employee-contribution-empty"><BriefcaseBusiness size={20}/><strong>No records for this month</strong><small>Activity assigned to this employee will appear here.</small></div>}
    </div>
    {records.length > 4 && <footer>Scroll to view all {records.length} records</footer>}
  </span>;
}

function ScoreCardRow({ row, month, canUploadPhoto, uploading, onPhotoUpload }: { row: EmployeeMonthlyReportRow; month: string; canUploadPhoto: boolean; uploading: boolean; onPhotoUpload: (row: EmployeeMonthlyReportRow, file: File) => void }) {
  const taskRate = ratio(row.tasksCompleted, row.tasksAssigned);
  return (
    <article className="employee-report-row">
      <div className="employee-report-identity">
        <label className={`employee-report-avatar ${canUploadPhoto ? "editable" : ""}`} title={canUploadPhoto ? `Upload profile photo for ${row.fullName}` : row.fullName}>
          {row.photoUrl ? <img src={row.photoUrl} alt={`${row.fullName} profile`} /> : initials(row.fullName)}
          {canUploadPhoto && <><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) onPhotoUpload(row, file); event.currentTarget.value = ""; }} /><span className="employee-photo-action">{uploading ? <RefreshCw size={11} className="spin" /> : <Camera size={11} />}</span></>}
        </label>
        <div>
          <strong>{row.fullName}</strong>
          <small>{row.employeeCode}</small>
          <span>{row.department}</span>
          <span>{row.role}</span>
        </div>
      </div>

      <div className="employee-report-metric attendance">
        <div className="attendance-pairs">
          <span><small>Present</small><strong>{row.presentDays}</strong><em>days</em></span>
          <span><small>Hours</small><strong>{row.workedHours}</strong><em>worked</em></span>
        </div>
        <p>{row.lateArrivals} late arrivals · {row.lateMinutes} min</p>
      </div>

      <div className="employee-report-metric">
        <strong>{row.tasksCompleted}<small> / {row.tasksAssigned}</small></strong>
        <span>completed / assigned <b>{taskRate}%</b></span>
        <i><span style={{ width: `${taskRate}%` }} /></i>
        <p>{row.tasksAssigned - row.tasksCompleted > 0 ? `${row.tasksAssigned - row.tasksCompleted} open tasks` : "No overdue work recorded"}</p>
      </div>

      <div className="employee-report-metric">
        <strong>{row.targetProgress}<small>%</small></strong>
        <span>{row.targetsAssigned} active {row.targetsAssigned === 1 ? "target" : "targets"}</span>
        <i><span style={{ width: `${row.targetProgress}%` }} /></i>
        <p>{row.targetsAssigned ? "Measured against assigned targets" : "No targets assigned this month"}</p>
      </div>

      <div className="employee-contribution">
        <button type="button" className="blue" aria-label={`View ${row.fullName}'s assigned leads`}><strong>{row.leadsAssigned}</strong><small>Leads</small><ContributionDetail row={row} type="leads" month={month} /></button>
        <button type="button" className="green" aria-label={`View ${row.fullName}'s converted leads`}><strong>{row.conversions}</strong><small>Converted</small><ContributionDetail row={row} type="conversions" month={month} /></button>
        <button type="button" className="orange" aria-label={`View ${row.fullName}'s applications`}><strong>{row.applications}</strong><small>Apps</small><ContributionDetail row={row} type="applications" month={month} /></button>
      </div>

      <div className={`employee-score ${scoreTone(row.score)}`}>
        <strong>{row.score}%</strong>
        <span>{row.score >= 80 ? "Strong" : row.score >= 60 ? "Stable" : "Needs focus"}</span>
      </div>
    </article>
  );
}

export function EmployeeMonthlyReport() {
  const { hasPermission } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [uploadingId, setUploadingId] = useState("");
  const [photoNotice, setPhotoNotice] = useState("");
  const canUploadPhoto = hasPermission("hr.documents.manage");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await EmployeeMonthlyReportService.get(month));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The employee report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  // Loading the initial report is the external synchronization performed by this effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const uploadProfilePhoto = async (row: EmployeeMonthlyReportRow, file: File) => {
    if (!file.type.startsWith("image/")) { setError("Choose a JPG, PNG, or WEBP profile image."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Profile pictures must be 5 MB or smaller."); return; }
    setUploadingId(row.id); setError(""); setPhotoNotice("");
    try {
      await HrmsService.uploadStaffDocument(row.id, "Profile Photo", file);
      await load();
      setPhotoNotice(`${row.fullName}'s profile picture was updated.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The profile picture could not be uploaded.");
    } finally {
      setUploadingId("");
    }
  };

  const departments = useMemo(() => [...new Set((report?.rows ?? []).map(row => row.department))].sort(), [report]);
  const rows = useMemo(() => (report?.rows ?? []).filter(row => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${row.fullName} ${row.employeeCode} ${row.department} ${row.role}`.toLowerCase().includes(query);
    return matchesSearch && (department === "ALL" || row.department === department);
  }), [department, report, search]);

  const csvContent = () => {
    const headers = ["Employee Code", "Employee", "Department", "Role", "Present Days", "Worked Hours", "Late Arrivals", "Late Minutes", "Tasks Completed", "Tasks Assigned", "Target Progress", "Assigned Leads", "Conversions", "Applications", "Performance Score"];
    return [headers, ...rows.map(row => [row.employeeCode, row.fullName, row.department, row.role, row.presentDays, row.workedHours, row.lateArrivals, row.lateMinutes, row.tasksCompleted, row.tasksAssigned, `${row.targetProgress}%`, row.leadsAssigned, row.conversions, row.applications, `${row.score}%`])]
      .map(line => line.map(escapeCsv).join(",")).join("\n");
  };

  const exportCsv = () => downloadBlob(`\ufeff${csvContent()}`, "text/csv;charset=utf-8", `AECS_Employee_Monthly_Report_${safeFileMonth(month)}.csv`);
  const exportExcel = () => {
    const tableRows = rows.map(row => `<tr>${[row.employeeCode, row.fullName, row.department, row.role, row.presentDays, row.workedHours, row.lateArrivals, row.tasksCompleted, row.tasksAssigned, `${row.targetProgress}%`, row.leadsAssigned, row.conversions, row.applications, `${row.score}%`].map(value => `<td>${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`).join("")}</tr>`).join("");
    const html = `<html><head><meta charset="utf-8"></head><body><h2>AECS Monthly Employee Report — ${monthLabel(month)}</h2><table border="1"><tr>${["Employee Code", "Employee", "Department", "Role", "Present Days", "Worked Hours", "Late Arrivals", "Tasks Completed", "Tasks Assigned", "Target Progress", "Assigned Leads", "Conversions", "Applications", "Performance Score"].map(value => `<th>${value}</th>`).join("")}</tr>${tableRows}</table></body></html>`;
    downloadBlob(html, "application/vnd.ms-excel;charset=utf-8", `AECS_Employee_Monthly_Report_${safeFileMonth(month)}.xls`);
  };

  const totals = report?.totals;
  const kpis = [
    { label: "Employees", value: totals?.employees ?? 0, note: "Active workforce", icon: Users, tone: "blue" },
    { label: "Worked hours", value: (totals?.workedHours ?? 0).toFixed(1), note: "Recorded this month", icon: Clock3, tone: "cyan" },
    { label: "Late arrivals", value: totals?.lateArrivals ?? 0, note: "Punctuality events", icon: CalendarDays, tone: "amber" },
    { label: "Tasks completed", value: totals?.tasksCompleted ?? 0, note: "Delivered work", icon: CheckCircle2, tone: "purple" },
    { label: "Conversions", value: totals?.conversions ?? 0, note: "Converted leads", icon: TrendingUp, tone: "green" },
    { label: "Team score", value: `${totals?.teamScore ?? 0}%`, note: "Weighted average", icon: Target, tone: "orange" },
  ];

  return (
    <section className="employee-monthly-report" id="employee-monthly-report">
      <header className="employee-report-header">
        <div>
          <div className="employee-report-security"><ShieldCheck size={13} /> Confidential <span>Authorized HR & management access</span></div>
          <h2>Monthly employee report</h2>
          <p>{monthLabel(month)} · Workforce attendance, delivery, targets, and contribution overview</p>
        </div>
        <div className="employee-report-actions">
          <label className="employee-report-month"><CalendarDays size={16} /><input type="month" value={month} max={currentMonth()} onChange={event => setMonth(event.target.value)} /></label>
          <button className="btn-primary report-view-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} />View month</button>
          <button className="btn-secondary" type="button" onClick={exportCsv} disabled={!rows.length}><Download size={15} />CSV</button>
          <button className="btn-secondary" type="button" onClick={exportExcel} disabled={!rows.length}><FileSpreadsheet size={15} />Excel</button>
          <button className="btn-primary report-print-button" type="button" onClick={() => window.print()} disabled={!rows.length}><Printer size={15} />Print / PDF</button>
        </div>
      </header>

      {error && <div className="employee-report-error"><AlertTriangle size={18} /><div><strong>Report unavailable</strong><span>{error}</span></div><button type="button" onClick={() => void load()}>Try again</button></div>}
      {photoNotice && <div className="employee-report-photo-notice"><CheckCircle2 size={16}/><span>{photoNotice}</span><button type="button" onClick={() => setPhotoNotice("")}>Dismiss</button></div>}

      <div className="employee-report-kpis" aria-busy={loading}>
        {kpis.map(({ label, value, note, icon: Icon, tone }) => <article key={label}><span className={tone}><Icon size={18} /></span><div><small>{label}</small><strong>{loading ? "—" : value}</strong><p>{note}</p></div></article>)}
      </div>

      <div className="employee-scorecard-panel">
        <div className="employee-scorecard-heading">
          <div><h3>Employee performance scorecard</h3><p>Grouped operational metrics for clear monthly comparison.</p></div>
          <div className="employee-score-legend"><span className="strong">80+ Strong</span><span className="stable">60–79 Stable</span><span className="focus">Below 60</span></div>
        </div>

        <div className="employee-report-filters">
          <label><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search employee, ID, role, or department" /></label>
          <select value={department} onChange={event => setDepartment(event.target.value)}><option value="ALL">All departments</option>{departments.map(value => <option key={value}>{value}</option>)}</select>
          <span>{rows.length} of {report?.rows.length ?? 0} employees</span>
        </div>

        <div className="employee-report-columns" aria-hidden="true"><span>Employee</span><span>Attendance</span><span>Task delivery</span><span>Targets</span><span>Business contribution</span><span>Score</span></div>
        <div className="employee-report-rows">
          {loading ? Array.from({ length: 3 }).map((_, index) => <div className="employee-report-skeleton" key={index}><i /><i /><i /><i /><i /><i /></div>) : rows.map(row => <ScoreCardRow row={row} month={month} key={row.id} canUploadPhoto={canUploadPhoto} uploading={uploadingId===row.id} onPhotoUpload={(employee,file)=>void uploadProfilePhoto(employee,file)} />)}
          {!loading && !rows.length && <div className="employee-report-empty"><UserRoundCheck size={30} /><h3>No employees match this report</h3><p>Try another month or clear the employee filters.</p></div>}
        </div>
      </div>

      {!!report?.warnings.length && <div className="employee-report-warning"><BriefcaseBusiness size={16} /><span>{report.warnings.join(" ")} Available metrics are still shown.</span></div>}
      <footer className="employee-report-method"><ShieldCheck size={15} /><span>Score methodology: attendance 30%, task delivery 25%, assigned target progress 25%, and CRM contribution 20%.</span><button type="button" onClick={() => window.print()}>Open print-ready report <ArrowUpRight size={13} /></button></footer>
    </section>
  );
}

export default EmployeeMonthlyReport;
