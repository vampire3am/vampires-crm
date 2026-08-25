import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CalendarDays,
  BookOpen,
  Clock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileCheck2,
  GraduationCap,
  PlaneTakeoff,
  Plus,
  Receipt,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { KpiTrendIndicator } from "../../components/common/KpiTrendIndicator";
import { AECS_ORGANIZATION } from "../../config/organization";
import { HrmsService } from "../../services/hrmsService";
import { useAuth } from "../auth/AuthProvider";
import { notifyError, notifySuccess } from "../../components/common/CrmNotifications";

// Trend series for 30-day analytics
const INTAKE_TREND_DATA: Array<{ day: string; leads: number; applications: number }> = [];
const DESTINATION_DATA: Array<{ name: string; value: number; color: string }> = [];

interface DashboardAppointment {
  id: string;
  time: string;
  studentName: string;
  target: string;
  counsellor: string;
  status: string;
}

interface DashboardActivity {
  id: string;
  type: "visa" | "offer" | "invoice" | "student";
  title: string;
  desc: string;
  time: string;
  user: string;
}

interface DashboardLeave {
  id: string;
  status: string;
}

const TODAY_APPOINTMENTS: DashboardAppointment[] = [];
const RECENT_ACTIVITIES: DashboardActivity[] = [];

export function ManagementDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [totalStudents, setTotalStudents] = useState(0);
  const [summary, setSummary] = useState({ counselling: 0, offers: 0, visaRatio: 0, revenue: 0 });
  const [dashboardError, setDashboardError] = useState("");
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [attendanceLoadError, setAttendanceLoadError] = useState("");
  const [, setAttendanceClock] = useState(0);
  const [myAttendance, setMyAttendance] = useState<Awaited<ReturnType<typeof HrmsService.getMyTodayAttendance>>>(null);
  const [myLeaves, setMyLeaves] = useState<DashboardLeave[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveType: "Casual Leave", fromDate: "", toDate: "", days: 0, reason: "" });
  const canRequestLeave = Boolean(profile && profile.role !== "ADMIN");

  const loadMyLeaves = async () => {
    if (!canRequestLeave) return;
    try { setMyLeaves(await HrmsService.getMyLeaves() as DashboardLeave[]); } catch { setMyLeaves([]); }
  };

  const openLeaveModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setLeaveForm({ leaveType: "Casual Leave", fromDate: today, toDate: today, days: 1, reason: "" });
    setShowLeaveModal(true);
  };

  const updateLeaveDate = (field: "fromDate" | "toDate", value: string) => setLeaveForm(current => {
    const next = { ...current, [field]: value };
    const from = new Date(`${next.fromDate}T00:00:00`);
    const to = new Date(`${next.toDate}T00:00:00`);
    const days = !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from ? Math.floor((to.getTime() - from.getTime()) / 86400000) + 1 : 0;
    return { ...next, days };
  });

  const submitLeaveRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leaveForm.days) return notifyError("Check the leave dates", "The end date cannot be before the start date.");
    if (!leaveForm.reason.trim()) return notifyError("Reason required", "Add a short reason or handover note before submitting.");
    setLeaveSubmitting(true);
    try {
      await HrmsService.requestLeave({ leave_type: leaveForm.leaveType, from_date: leaveForm.fromDate, to_date: leaveForm.toDate, reason: leaveForm.reason.trim() });
      await loadMyLeaves();
      setShowLeaveModal(false);
      notifySuccess("Leave request submitted", "Your request is now in the HRMS approval queue for HR or management.");
    } catch (error) { notifyError("Leave request failed", error instanceof Error ? error.message : "The request could not be submitted."); }
    finally { setLeaveSubmitting(false); }
  };

  const loadMyAttendance = async () => {
    try { setMyAttendance(await HrmsService.getMyTodayAttendance()); setAttendanceLoadError(""); }
    catch(error) { setMyAttendance(null); setAttendanceLoadError(error instanceof Error ? error.message : "Attendance profile could not be loaded"); }
  };

  const punchAttendance = async (action: "in" | "out") => {
    setAttendanceBusy(true); setAttendanceMessage("");
    try {
      if(action === "in") await HrmsService.clockIn(); else await HrmsService.clockOut();
      await loadMyAttendance();
      setAttendanceMessage(action === "in" ? "Clock-in recorded successfully." : "Clock-out recorded successfully.");
    } catch(error) { setAttendanceMessage(error instanceof Error ? error.message : "Attendance could not be recorded."); }
    finally { setAttendanceBusy(false); }
  };

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const loadSummary = async () => {
      const { data, error } = await supabase.rpc("management_dashboard_summary");
      if (!active) return;
      if (error) {
        setDashboardError("Live dashboard data could not be loaded. Check your connection or ask an administrator to verify your permissions.");
        return;
      }
      const live=data as{students?:number;counselling?:number;offers?:number;visa_ratio?:number;month_revenue?:number};
      const nextMetrics = {
        students: live.students || 0,
        counselling: live.counselling || 0,
        offers: live.offers || 0,
        visaRatio: live.visa_ratio || 0,
        revenue: live.month_revenue || 0,
      };
      setTotalStudents(nextMetrics.students);
      setSummary({
        counselling: nextMetrics.counselling,
        offers: nextMetrics.offers,
        visaRatio: nextMetrics.visaRatio,
        revenue: nextMetrics.revenue,
      });
      setDashboardError("");
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadSummary(), 250);
    };

    void loadSummary();
    const channel = ["students", "counselling_records", "university_applications", "visa_tracking", "finance_receipts"]
      .reduce((subscription, table) => subscription.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh), supabase.channel("management-dashboard-live"))
      .subscribe();

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => { void loadMyAttendance(); }, []);
  useEffect(() => { void loadMyLeaves(); }, [canRequestLeave]);
  useEffect(() => { const timer=setInterval(() => setAttendanceClock(value => value + 1), 60000); return () => clearInterval(timer); }, []);

  const workedToday = myAttendance?.clockIn ? (() => {
    const end=myAttendance.clockOut ? new Date(myAttendance.clockOut) : new Date();
    const minutes=Math.max(0,Math.floor((end.getTime()-new Date(myAttendance.clockIn).getTime())/60000));
    return `${Math.floor(minutes/60)}h ${minutes%60}m`;
  })() : "0h 0m";

  return (
    <div className="page-container">
      {/* Executive Welcome Header */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>Executive Operations Hub</h2>
          <p>
            Real-time admissions pipeline, counselling schedule, and revenue analytics for {AECS_ORGANIZATION.officeName}.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/students/register")}
          >
            <UserPlus size={15} />
            <span>Student Registration</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/leads", { state: { openLeadCapture: true } })}
          >
            <Plus size={15} />
            <span>Quick Lead</span>
          </button>
        </div>
      </div>

      {dashboardError && (
        <div className="dashboard-error-banner" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Dashboard unavailable</strong>
            <span>{dashboardError}</span>
          </div>
          <button type="button" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      <section className="dashboard-attendance-card" aria-label="My attendance today">
        <div className="dashboard-attendance-icon"><Clock size={22} /></div>
        <div className="dashboard-attendance-copy">
          <span className="page-category-eyebrow">My Attendance Today</span>
          <strong>{myAttendance ? myAttendance.fullName : "Employee attendance"}</strong>
          <span>
            {!myAttendance ? (attendanceLoadError || "No active employee profile is linked to this login.") :
             !myAttendance.clockIn ? "Shift not started — clock in when you begin work." :
             myAttendance.clockOut ? `Shift completed · Worked ${workedToday} · ${new Date(myAttendance.clockIn).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kathmandu"})}–${new Date(myAttendance.clockOut).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kathmandu"})}` :
             `Working now · ${workedToday} worked · Clocked in at ${new Date(myAttendance.clockIn).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kathmandu"})}`}
          </span>
          {attendanceMessage && <small>{attendanceMessage}</small>}
        </div>
        <div className="dashboard-attendance-status">
          <span className={`badge-status ${myAttendance?.clockOut ? "enrolled" : myAttendance?.clockIn ? "counselling" : "new-lead"}`}>
            {myAttendance?.clockOut ? "SHIFT COMPLETE" : myAttendance?.clockIn ? "IN OFFICE" : "NOT CLOCKED IN"}
          </span>
        </div>
        <div className="dashboard-attendance-actions">
          <button type="button" className="btn-primary" disabled={attendanceBusy || !myAttendance || Boolean(myAttendance.clockIn)} onClick={() => void punchAttendance("in")}><Clock size={15}/> Clock In</button>
          <button type="button" className="btn-secondary" disabled={attendanceBusy || !myAttendance?.clockIn || Boolean(myAttendance.clockOut)} onClick={() => void punchAttendance("out")}><CheckCircle2 size={15}/> Clock Out</button>
          {canRequestLeave && <button type="button" className="btn-secondary dashboard-leave-button" onClick={openLeaveModal}><CalendarDays size={15}/> Request Leave</button>}
        </div>
      </section>

      {canRequestLeave && <section className="dashboard-leave-strip" aria-label="My leave requests">
        <div className="dashboard-leave-strip-icon"><CalendarDays size={18}/></div>
        <div><span>My leave requests</span><strong>{myLeaves.filter(item=>item.status==="PENDING").length} pending</strong><small>{myLeaves.length ? `${myLeaves.filter(item=>item.status==="APPROVED").length} approved · ${myLeaves.filter(item=>item.status==="REJECTED").length} rejected` : "No leave applications submitted yet"}</small></div>
        <button type="button" className="btn-ghost" onClick={()=>void loadMyLeaves()}><span>Refresh status</span><ChevronRight size={14}/></button>
      </section>}

      {showLeaveModal && canRequestLeave && <div className="modal-backdrop-clean" onClick={()=>setShowLeaveModal(false)}>
        <div className="modal-dialog-clean dashboard-leave-modal" onClick={event=>event.stopPropagation()}>
          <div className="modal-header-clean"><div><span className="page-category-eyebrow">Staff self-service</span><h3>Request leave</h3><p>Your application goes directly to the HRMS approval queue.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowLeaveModal(false)} aria-label="Close leave request"><X size={18}/></button></div>
          <form onSubmit={submitLeaveRequest}>
            <div className="modal-body-clean">
              <div className="hrms-self-applicant"><CalendarDays size={17}/><div><strong>{myAttendance?.fullName || profile?.full_name || "Staff member"}</strong><span>{myAttendance?.employeeCode || "Linked employee profile"}</span></div></div>
              <div className="form-group"><label>Leave category *</label><select required value={leaveForm.leaveType} onChange={event=>setLeaveForm({...leaveForm,leaveType:event.target.value})}><option>Annual Leave</option><option>Casual Leave</option><option>Sick / Medical</option><option>Maternity / Paternity</option><option>Festival Leave</option></select></div>
              <div className="form-row-2"><div className="form-group"><label>From date *</label><input type="date" required value={leaveForm.fromDate} onChange={event=>updateLeaveDate("fromDate",event.target.value)}/></div><div className="form-group"><label>To date *</label><input type="date" required min={leaveForm.fromDate} value={leaveForm.toDate} onChange={event=>updateLeaveDate("toDate",event.target.value)}/></div></div>
              <div className="hrms-leave-duration"><CalendarDays size={16}/><span>Requested duration</span><strong>{leaveForm.days} {leaveForm.days===1?"day":"days"}</strong></div>
              <div className="form-group"><label>Reason / handover notes *</label><textarea required rows={4} value={leaveForm.reason} onChange={event=>setLeaveForm({...leaveForm,reason:event.target.value})} placeholder="Explain the reason and any work that needs handing over…"/></div>
            </div>
            <div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowLeaveModal(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={leaveSubmitting}>{leaveSubmitting?"Submitting…":"Submit request"}</button></div>
          </form>
        </div>
      </div>}

      {/* Flagship KPI Strip */}
      <div className="metrics-grid-4" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Active Student Leads</span>
            <div className="metric-icon-wrap blue">
              <Users size={17} />
            </div>
          </div>
          <div className="metric-value">{totalStudents}</div>
          <KpiTrendIndicator metricKey="dashboard.students" value={totalStudents} label="Live registered records" />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">In Counselling</span>
            <div className="metric-icon-wrap amber">
              <BookOpen size={17} />
            </div>
          </div>
          <div className="metric-value">{summary.counselling}</div>
          <KpiTrendIndicator metricKey="dashboard.counselling" value={summary.counselling} label="Recorded counselling sessions" />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Offers Secured</span>
            <div className="metric-icon-wrap purple">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="metric-value">{summary.offers}</div>
          <KpiTrendIndicator metricKey="dashboard.offers" value={summary.offers} label="Offer and post-offer stages" />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Visa Grant Ratio</span>
            <div className="metric-icon-wrap green">
              <GraduationCap size={17} />
            </div>
          </div>
          <div className="metric-value">{summary.visaRatio.toFixed(1)}%</div>
          <KpiTrendIndicator metricKey="dashboard.visa-ratio" value={summary.visaRatio} label="Based on recorded decisions" />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Month Revenue (NPR)</span>
            <div className="metric-icon-wrap green">
              <TrendingUp size={17} />
            </div>
          </div>
          <div className="metric-value">₨ {summary.revenue.toLocaleString("en-NP")}</div>
          <KpiTrendIndicator metricKey="dashboard.month-revenue" value={summary.revenue} label="Paid invoices this month" />
        </div>
      </div>

      {/* Main Grid: Charts & Operations Agenda */}
      <div className="grid-2col" style={{ gridTemplateColumns: "1.45fr 1fr", marginBottom: "24px" }}>
        {/* Left: 30-Day Lead & Intake Trajectory */}
        <div className="crm-panel" style={{ marginBottom: 0 }}>
          <div className="panel-header-bar">
            <div>
              <h3>30-Day Intake & Application Trajectory</h3>
              <p>Daily volume of prospective inquiries, university applications, and class intakes</p>
            </div>
            <span className="status-pill">Asia/Kathmandu (UTC+05:45)</span>
          </div>

          <div className="panel-body" style={{ height: "300px" }}>
            {INTAKE_TREND_DATA.length > 0 ? <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={INTAKE_TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "12px",
                    boxShadow: "var(--shadow-md)",
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11.5px", paddingTop: "10px" }} />
                <Area type="monotone" dataKey="leads" name="New Inquiries" stroke="#F97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="applications" name="Uni Applications" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorApps)" />
              </AreaChart>
            </ResponsiveContainer> : <div className="dashboard-empty-state">Trend data will appear after leads and applications are recorded.</div>}
          </div>
        </div>

        {/* Right: Today's Counselling Agenda */}
        <div className="crm-panel" style={{ marginBottom: 0 }}>
          <div className="panel-header-bar">
            <div>
              <h3>Today's Counselling Appointments</h3>
              <p>Scheduled consultations at the Bagbazar counselling desk</p>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate("/counselling")}
            >
              <span>View All</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {TODAY_APPOINTMENTS.map(item => (
              <div
                key={item.id}
                style={{
                  padding: "11px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-card-subtle)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      padding: "6px 9px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--accent-blue)",
                    }}
                  >
                    {item.time}
                  </div>
                  <div>
                    <strong style={{ fontSize: "12.5px", color: "var(--text-main)", display: "block" }}>
                      {item.studentName}
                    </strong>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {item.target} · {item.counsellor}
                    </span>
                  </div>
                </div>

                <span
                  className={`badge-status ${item.status === "In Progress" ? "counselling" : item.status === "Confirmed" ? "enrolled" : "new-lead"}`}
                >
                  {item.status}
                </span>
              </div>
            ))}
            {TODAY_APPOINTMENTS.length === 0 && <div className="dashboard-empty-state">No counselling appointments scheduled for today.</div>}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Market Distribution & Recent Activity Stream */}
      <div className="grid-2col" style={{ gridTemplateColumns: "1fr 1.45fr" }}>
        {/* Left: Destination Market Distribution */}
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Destination Preference</h3>
              <p>Top study abroad countries among active applicants</p>
            </div>
            <span className="status-pill">2026/27 Intake</span>
          </div>

          <div className="panel-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {DESTINATION_DATA.map(d => (
                <div key={d.name} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <strong style={{ color: "var(--text-main)" }}>{d.name}</strong>
                    <span className="code-font" style={{ fontWeight: 700, color: "var(--text-muted)" }}>
                      {d.value}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      borderRadius: "99px",
                      background: "var(--bg-card-subtle)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${d.value}%`,
                        background: d.color,
                        borderRadius: "99px",
                      }}
                    />
                  </div>
                </div>
              ))}
              {DESTINATION_DATA.length === 0 && <div className="dashboard-empty-state">Destination preferences will appear after student intake records are added.</div>}
            </div>
          </div>
        </div>

        {/* Right: Recent Operational Activity Stream */}
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Live Operations Stream</h3>
              <p>Auditable log of admissions, visa grants, and billing transactions</p>
            </div>
            <span className="status-pill">Live Feed</span>
          </div>

          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {RECENT_ACTIVITIES.map(act => (
              <div
                key={act.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  paddingBottom: "10px",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background:
                      act.type === "visa"
                        ? "var(--success-soft)"
                        : act.type === "offer"
                        ? "var(--purple-soft)"
                        : act.type === "invoice"
                        ? "var(--accent-blue-soft)"
                        : "var(--warning-soft)",
                    color:
                      act.type === "visa"
                        ? "var(--success)"
                        : act.type === "offer"
                        ? "var(--purple)"
                        : act.type === "invoice"
                        ? "var(--accent-blue)"
                        : "var(--warning)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {act.type === "visa" ? (
                    <GraduationCap size={16} />
                  ) : act.type === "offer" ? (
                    <CheckCircle2 size={16} />
                  ) : act.type === "invoice" ? (
                    <Receipt size={16} />
                  ) : (
                    <UserPlus size={16} />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: "12.5px", color: "var(--text-main)" }}>{act.title}</strong>
                    <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>{act.time}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 3px" }}>{act.desc}</p>
                  <span style={{ fontSize: "10.5px", color: "var(--accent-blue)", fontWeight: 600 }}>By: {act.user}</span>
                </div>
              </div>
            ))}
            {RECENT_ACTIVITIES.length === 0 && <div className="dashboard-empty-state">No operational activity has been recorded yet.</div>}
          </div>
        </div>
      </div>

      {/* Fast Navigation Workspace Cards */}
      <div className="metrics-grid-4" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        <button
          type="button"
          className="metric-box"
          style={{ cursor: "pointer", textAlign: "left" }}
          onClick={() => navigate("/students")}
        >
          <div className="metric-icon-wrap blue">
            <Users size={17} />
          </div>
          <strong style={{ fontSize: "12.5px", marginTop: "4px" }}>Students & Leads</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Directory & Kanban</span>
        </button>

        <button
          type="button"
          className="metric-box"
          style={{ cursor: "pointer", textAlign: "left" }}
          onClick={() => navigate("/counselling")}
        >
          <div className="metric-icon-wrap amber">
            <BookOpen size={17} />
          </div>
          <strong style={{ fontSize: "12.5px", marginTop: "4px" }}>Counselling Hub</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Notes & Follow-ups</span>
        </button>

        <button
          type="button"
          className="metric-box"
          style={{ cursor: "pointer", textAlign: "left" }}
          onClick={() => navigate("/applications")}
        >
          <div className="metric-icon-wrap purple">
            <PlaneTakeoff size={17} />
          </div>
          <strong style={{ fontSize: "12.5px", marginTop: "4px" }}>Applications & Visas</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Offers & CAS/I-20</span>
        </button>

        <button
          type="button"
          className="metric-box"
          style={{ cursor: "pointer", textAlign: "left" }}
          onClick={() => navigate("/documents")}
        >
          <div className="metric-icon-wrap blue">
            <FileCheck2 size={17} />
          </div>
          <strong style={{ fontSize: "12.5px", marginTop: "4px" }}>Document Desk</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>10-Point Checklist</span>
        </button>

        <button
          type="button"
          className="metric-box"
          style={{ cursor: "pointer", textAlign: "left" }}
          onClick={() => navigate("/classes")}
        >
          <div className="metric-icon-wrap green">
            <GraduationCap size={17} />
          </div>
          <strong style={{ fontSize: "12.5px", marginTop: "4px" }}>Classes & Batches</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>IELTS / PTE / German</span>
        </button>

        <button
          type="button"
          className="metric-box"
          style={{ cursor: "pointer", textAlign: "left" }}
          onClick={() => navigate("/finance")}
        >
          <div className="metric-icon-wrap amber">
            <CreditCard size={17} />
          </div>
          <strong style={{ fontSize: "12.5px", marginTop: "4px" }}>Finance & COA</strong>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>454 Master Ledgers</span>
        </button>
      </div>
    </div>
  );
}

export default ManagementDashboard;
