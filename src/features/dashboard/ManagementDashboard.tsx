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
  Activity,
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
  Receipt,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { AECS_ORGANIZATION } from "../../config/organization";
import { HrmsService } from "../../services/hrmsService";
import {
  DashboardService,
  type DashboardActivity,
  type DashboardAppointment,
  type DashboardDestination,
  type DashboardTrendPoint,
} from "../../services/dashboardService";
import { useAuth } from "../auth/AuthProvider";
import { notifyError, notifySuccess } from "../../components/common/CrmNotifications";
import { BsDateInput } from "../../components/ui/BsDateInput";
import { LeaveAllocationPicker, type LeaveAllocation } from "../../components/ui/LeaveAllocationPicker";
import { todayAd } from "../../lib/nepaliDate";

interface DashboardLeave {
  id: string;
  status: string;
}

export function ManagementDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [totalStudents, setTotalStudents] = useState(0);
  const [summary, setSummary] = useState({ counselling: 0, offers: 0, visaRatio: 0, revenue: 0 });
  const [trendData, setTrendData] = useState<DashboardTrendPoint[]>([]);
  const [destinations, setDestinations] = useState<DashboardDestination[]>([]);
  const [appointments, setAppointments] = useState<DashboardAppointment[]>([]);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [dashboardError, setDashboardError] = useState("");
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [attendanceLoadError, setAttendanceLoadError] = useState("");
  const [, setAttendanceClock] = useState(0);
  const [myAttendance, setMyAttendance] = useState<Awaited<ReturnType<typeof HrmsService.getMyTodayAttendance>>>(null);
  const [myLeaves, setMyLeaves] = useState<DashboardLeave[]>([]);
  const [leavePolicies, setLeavePolicies] = useState<Array<{leaveType:string;monthlyCredit:number;isPaid:boolean}>>([]);
  const [leaveBalances, setLeaveBalances] = useState<Array<{leaveType:string;closing:number}>>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ allocations:[{leaveType:"Casual Leave",days:1}] as LeaveAllocation[], fromDate: "", toDate: "", days: 0, duration:"FULL_DAY" as "FULL_DAY"|"HALF_DAY", reason: "" });
  const canRequestLeave = Boolean(profile && profile.role !== "ADMIN");
  const canUseAttendance = Boolean(profile && profile.role !== "ADMIN");

  const loadMyLeaves = async () => {
    if (!canRequestLeave) return;
    try {
      const [requests,policies,balances]=await Promise.all([HrmsService.getMyLeaves(),HrmsService.getLeavePolicies(),HrmsService.getLeaveBalances()]);
      setMyLeaves(requests as DashboardLeave[]);
      setLeavePolicies(policies);
      setLeaveBalances(balances);
    } catch { setMyLeaves([]); }
  };

  const openLeaveModal = () => {
    const today = todayAd();
    setLeaveForm({ allocations:[{leaveType:"Casual Leave",days:1}], fromDate: today, toDate: today, days: 1, duration:"FULL_DAY", reason: "" });
    setShowLeaveModal(true);
  };

  const updateLeaveDate = (field: "fromDate" | "toDate", value: string) => setLeaveForm(current => {
    const next = { ...current, [field]: value };
    const from = new Date(`${next.fromDate}T00:00:00`);
    const to = new Date(`${next.toDate}T00:00:00`);
    const days = !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from ? Math.floor((to.getTime() - from.getTime()) / 86400000) + 1 : 0;
    const requestedDays=next.duration==="HALF_DAY"?0.5:days;
    return { ...next, days:requestedDays, allocations:next.allocations.length===1?[{...next.allocations[0],days:requestedDays}]:next.allocations };
  });

  const submitLeaveRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leaveForm.days) return notifyError("Check the leave dates", "The end date cannot be before the start date.");
    if (!leaveForm.reason.trim()) return notifyError("Reason required", "Add a short reason or handover note before submitting.");
    const allocationTotal=leaveForm.allocations.reduce((sum,item)=>sum+item.days,0);
    if(!leaveForm.allocations.length||Math.abs(allocationTotal-leaveForm.days)>0.001)return notifyError("Complete the leave allocation",`Allocate exactly ${leaveForm.days.toFixed(1)} days across the selected categories.`);
    if(leaveForm.allocations.length>1&&(leaveForm.days!==1||leaveForm.fromDate!==leaveForm.toDate))return notifyError("Combined balance is for one full day","Choose one date and Full day to combine two 0.5-day balances.");
    setLeaveSubmitting(true);
    try {
      await HrmsService.requestLeave({ leave_type: leaveForm.allocations[0].leaveType, allocations:leaveForm.allocations.map(item=>({leave_type:item.leaveType,days:item.days})), from_date: leaveForm.fromDate, to_date: leaveForm.toDate, duration:leaveForm.duration, reason: leaveForm.reason.trim() });
      await loadMyLeaves();
      setShowLeaveModal(false);
      notifySuccess("Leave request submitted", "Your request is now waiting for HR approval.");
    } catch (error) { notifyError("Leave request failed", error instanceof Error ? error.message : "The request could not be submitted."); }
    finally { setLeaveSubmitting(false); }
  };

  const loadMyAttendance = async () => {
    if (!canUseAttendance) { setMyAttendance(null); setAttendanceLoadError(""); return; }
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

    const loadDashboard = async () => {
      const [summaryResult, operationalResult] = await Promise.allSettled([
        supabase.rpc("management_dashboard_summary"),
        DashboardService.getOperationalData(),
      ]);
      if (!active) return;
      if (summaryResult.status === "rejected" || summaryResult.value.error) {
        setDashboardError("Live dashboard data could not be loaded. Check your connection or ask an administrator to verify your permissions.");
      } else {
        const live=summaryResult.value.data as{students?:number;counselling?:number;offers?:number;visa_ratio?:number;month_revenue?:number};
        setTotalStudents(live.students || 0);
        setSummary({ counselling: live.counselling || 0, offers: live.offers || 0, visaRatio: live.visa_ratio || 0, revenue: live.month_revenue || 0 });
        setDashboardError("");
      }
      if (operationalResult.status === "fulfilled") {
        setTrendData(operationalResult.value.trend);
        setDestinations(operationalResult.value.destinations);
        setAppointments(operationalResult.value.appointments);
        setActivities(operationalResult.value.activities);
      }
      setDashboardLoading(false);
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadDashboard(), 250);
    };

    void loadDashboard();
    const channel = ["students", "study_preferences", "leads", "lead_follow_ups", "lead_activities", "activity_logs", "audit_logs", "counselling_records", "university_applications", "visa_tracking", "finance_receipts"]
      .reduce((subscription, table) => subscription.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh), supabase.channel("management-dashboard-live"))
      .subscribe();

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [dashboardRefreshKey]);

  useEffect(() => { void loadMyAttendance(); }, [canUseAttendance]);
  useEffect(() => { void loadMyLeaves(); }, [canRequestLeave]);
  useEffect(() => { const timer=setInterval(() => setAttendanceClock(value => value + 1), 60000); return () => clearInterval(timer); }, []);

  const workedToday = myAttendance?.clockIn ? (() => {
    const end=myAttendance.clockOut ? new Date(myAttendance.clockOut) : new Date();
    const minutes=Math.max(0,Math.floor((end.getTime()-new Date(myAttendance.clockIn).getTime())/60000));
    return `${Math.floor(minutes/60)}h ${minutes%60}m`;
  })() : "0h 0m";

  const metricFooter = (label: string) => (
    <span className="dashboard-metric-footer"><Activity size={13} aria-hidden="true" /><span>{label}</span></span>
  );

  return (
    <div className="page-container dashboard-workspace">
      {/* Executive Welcome Header */}
      <div className="page-header-row dashboard-page-header">
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
        </div>
      </div>

      {dashboardError && (
        <div className="dashboard-error-banner" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Dashboard unavailable</strong>
            <span>{dashboardError}</span>
          </div>
          <button type="button" onClick={() => { setDashboardLoading(true); setDashboardRefreshKey(value => value + 1); }}>Retry</button>
        </div>
      )}

      {canUseAttendance && <section className="dashboard-attendance-card" aria-label="My attendance today">
        <div className="dashboard-attendance-icon"><Clock size={22} /></div>
        <div className="dashboard-attendance-copy">
          <span className="dashboard-attendance-label">Attendance today</span>
          <div className="dashboard-attendance-identity">
            <strong>{myAttendance ? myAttendance.fullName : "Employee attendance"}</strong>
            <span className={`badge-status ${myAttendance?.clockOut ? "enrolled" : myAttendance?.clockIn ? "counselling" : "new-lead"}`}>
              {myAttendance?.clockOut ? "Shift complete" : myAttendance?.clockIn ? "In office" : "Not clocked in"}
            </span>
          </div>
          <span>
            {!myAttendance ? (attendanceLoadError || "No active employee profile is linked to this login.") :
             !myAttendance.clockIn ? "Shift not started — clock in when you begin work." :
             myAttendance.clockOut ? `Shift completed · Worked ${workedToday} · ${new Date(myAttendance.clockIn).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kathmandu"})}–${new Date(myAttendance.clockOut).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kathmandu"})}` :
             `Working now · ${workedToday} worked · Clocked in at ${new Date(myAttendance.clockIn).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kathmandu"})}`}
          </span>
          {attendanceMessage && <small>{attendanceMessage}</small>}
          {canRequestLeave && (
            <div className="dashboard-leave-inline" aria-live="polite">
              <CalendarDays size={14} aria-hidden="true" />
              <span>Leave:</span>
              <strong>{myLeaves.filter(item=>item.status==="PENDING").length} pending</strong>
              <span aria-hidden="true">·</span>
              <span>{myLeaves.filter(item=>item.status==="APPROVED").length} approved</span>
              <span aria-hidden="true">·</span>
              <span>{myLeaves.filter(item=>item.status==="REJECTED").length} rejected</span>
              <button type="button" onClick={()=>void loadMyLeaves()} aria-label="Refresh leave request status"><RefreshCw size={13}/></button>
            </div>
          )}
        </div>
        <div className="dashboard-attendance-actions">
          <button type="button" className="btn-secondary dashboard-clock-action" disabled={attendanceBusy || !myAttendance || Boolean(myAttendance.clockIn)} onClick={() => void punchAttendance("in")}><Clock size={15}/> Clock In</button>
          <button type="button" className="btn-secondary" disabled={attendanceBusy || !myAttendance?.clockIn || Boolean(myAttendance.clockOut)} onClick={() => void punchAttendance("out")}><CheckCircle2 size={15}/> Clock Out</button>
          {canRequestLeave && <button type="button" className="btn-secondary dashboard-leave-button" onClick={openLeaveModal}><CalendarDays size={15}/> Request Leave</button>}
        </div>
      </section>}

      {showLeaveModal && canRequestLeave && <div className="modal-backdrop-clean" onClick={()=>setShowLeaveModal(false)}>
        <div className="modal-dialog-clean dashboard-leave-modal" onClick={event=>event.stopPropagation()}>
          <div className="modal-header-clean"><div><span className="page-category-eyebrow">Staff self-service</span><h3>Request leave</h3><p>Your BS-dated application goes directly to HR.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowLeaveModal(false)} aria-label="Close leave request"><X size={18}/></button></div>
          <form onSubmit={submitLeaveRequest}>
            <div className="modal-body-clean">
              <div className="hrms-self-applicant"><CalendarDays size={17}/><div><strong>{myAttendance?.fullName || profile?.full_name || "Staff member"}</strong><span>{myAttendance?.employeeCode || "Linked employee profile"}</span></div></div>
              <div className="form-group"><label>Duration *</label><select value={leaveForm.duration} onChange={event=>setLeaveForm(current=>{const duration=event.target.value as "FULL_DAY"|"HALF_DAY";const days=duration==="HALF_DAY"?0.5:Math.max(1,current.days);return{...current,duration,toDate:duration==="HALF_DAY"?current.fromDate:current.toDate,days,allocations:[{leaveType:current.allocations[0]?.leaveType??"Casual Leave",days}]}})}><option value="FULL_DAY">Full day</option><option value="HALF_DAY">Half day (0.5)</option></select></div>
              <div className="form-row-2"><div className="form-group"><label>From date (BS) *</label><BsDateInput required value={leaveForm.fromDate} onChange={value=>updateLeaveDate("fromDate",value)}/></div><div className="form-group"><label>To date (BS) *</label><BsDateInput required disabled={leaveForm.duration==="HALF_DAY"} value={leaveForm.toDate} onChange={value=>updateLeaveDate("toDate",value)}/></div></div>
              <div className="hrms-leave-duration"><CalendarDays size={16}/><span>Requested duration</span><strong>{leaveForm.days} {leaveForm.days===1?"day":"days"}</strong></div>
              <LeaveAllocationPicker policies={leavePolicies} balances={leaveBalances} requestedDays={leaveForm.days} value={leaveForm.allocations} onChange={allocations=>setLeaveForm(current=>({...current,allocations}))}/>
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
            <span className="metric-label">Registered Students</span>
            <div className="metric-icon-wrap blue">
              <Users size={17} />
            </div>
          </div>
          <div className="metric-value">{totalStudents}</div>
          {metricFooter("Live registered records")}
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">In Counselling</span>
            <div className="metric-icon-wrap amber">
              <BookOpen size={17} />
            </div>
          </div>
          <div className="metric-value">{summary.counselling}</div>
          {metricFooter("Recorded counselling sessions")}
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Offers Secured</span>
            <div className="metric-icon-wrap purple">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="metric-value">{summary.offers}</div>
          {metricFooter("Offer and post-offer stages")}
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Visa Grant Ratio</span>
            <div className="metric-icon-wrap green">
              <GraduationCap size={17} />
            </div>
          </div>
          <div className="metric-value">{summary.visaRatio.toFixed(1)}%</div>
          {metricFooter("Based on recorded decisions")}
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Month Revenue (NPR)</span>
            <div className="metric-icon-wrap green">
              <TrendingUp size={17} />
            </div>
          </div>
          <div className="metric-value">₨ {summary.revenue.toLocaleString("en-NP")}</div>
          {metricFooter("Paid invoices this month")}
        </div>
      </div>

      {/* Main Grid: Charts & Operations Agenda */}
      <div className="grid-2col dashboard-content-grid dashboard-primary-grid">
        {/* Left: 30-Day Lead & Intake Trajectory */}
        <div className="crm-panel dashboard-insight-panel dashboard-trajectory-panel">
          <div className="panel-header-bar">
            <div className="dashboard-panel-heading">
              <span className="dashboard-panel-icon orange" aria-hidden="true"><TrendingUp size={16} /></span>
              <div>
                <h3>30-Day Intake & Application Trajectory</h3>
                <p>Daily volume of prospective inquiries, university applications, and class intakes</p>
              </div>
            </div>
            <span className="panel-static-label">Asia/Kathmandu (UTC+05:45)</span>
          </div>

          <div className="panel-body dashboard-chart-body">
            {trendData.some(item => item.leads > 0 || item.applications > 0) ? <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} minTickGap={20} />
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
            </ResponsiveContainer> : <div className="dashboard-empty-state">{dashboardLoading ? "Loading 30-day intake activity…" : "Trend data will appear after leads and applications are recorded."}</div>}
          </div>
        </div>

        {/* Right: Today's Counselling Agenda */}
        <div className="crm-panel dashboard-insight-panel dashboard-appointments-panel">
          <div className="panel-header-bar">
            <div className="dashboard-panel-heading">
              <span className="dashboard-panel-icon blue" aria-hidden="true"><CalendarDays size={16} /></span>
              <div>
                <h3>Today's Counselling Appointments</h3>
                <p>Scheduled consultations at the Bagbazar counselling desk</p>
              </div>
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

          <div className="dashboard-appointments-list">
            {appointments.map(item => (
              <div
                key={item.id}
                className="dashboard-appointment-item"
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
            {appointments.length === 0 && <div className="dashboard-empty-state">{dashboardLoading ? "Loading today's follow-ups…" : "No counselling appointments scheduled for today."}</div>}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Market Distribution & Recent Activity Stream */}
      <div className="grid-2col dashboard-content-grid dashboard-secondary-grid">
        {/* Left: Destination Market Distribution */}
        <div className="crm-panel dashboard-insight-panel dashboard-destinations-panel">
          <div className="panel-header-bar">
            <div className="dashboard-panel-heading">
              <span className="dashboard-panel-icon purple" aria-hidden="true"><PlaneTakeoff size={16} /></span>
              <div>
                <h3>Destination Preference</h3>
                <p>Top study abroad countries among active applicants</p>
              </div>
            </div>
            <span className="panel-static-label">2026/27 intake</span>
          </div>

          <div className="panel-body dashboard-destination-body">
            <div className="dashboard-destination-list">
              {destinations.map(d => (
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
              {destinations.length === 0 && <div className="dashboard-empty-state">{dashboardLoading ? "Loading destination preferences…" : "Destination preferences will appear after student intake records are added."}</div>}
            </div>
          </div>
        </div>

        {/* Right: Recent Operational Activity Stream */}
        <div className="crm-panel dashboard-insight-panel dashboard-activity-panel">
          <div className="panel-header-bar">
            <div className="dashboard-panel-heading">
              <span className="dashboard-panel-icon green" aria-hidden="true"><Activity size={16} /></span>
              <div>
                <h3>Live Operations Stream</h3>
                <p>Auditable log of admissions, visa grants, and billing transactions</p>
              </div>
            </div>
            <span className="panel-static-label"><span className="live-indicator" aria-hidden="true" />Live feed</span>
          </div>

          <div className="dashboard-activity-list">
            {activities.map(act => (
              <div
                key={act.id}
                className="dashboard-activity-item"
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
            {activities.length === 0 && <div className="dashboard-empty-state">{dashboardLoading ? "Loading recent CRM activity…" : "No operational activity has been recorded yet."}</div>}
          </div>
        </div>
      </div>

      <nav className="dashboard-shortcuts" aria-label="Workspace shortcuts">
        {[
          { label: "Students & Leads", detail: "Directory & Kanban", path: "/students", icon: <Users size={17} />, tone: "blue" },
          { label: "Counselling Hub", detail: "Notes & follow-ups", path: "/counselling", icon: <BookOpen size={17} />, tone: "amber" },
          { label: "Applications & Visas", detail: "Offers & CAS/I-20", path: "/applications", icon: <PlaneTakeoff size={17} />, tone: "purple" },
          { label: "Document Desk", detail: "Compliance checklist", path: "/documents", icon: <FileCheck2 size={17} />, tone: "blue" },
          { label: "Classes & Batches", detail: "IELTS / PTE / German", path: "/classes", icon: <GraduationCap size={17} />, tone: "green" },
          { label: "Finance & COA", detail: "Ledgers & receipts", path: "/finance", icon: <CreditCard size={17} />, tone: "amber" },
        ].map(item => (
          <button type="button" className="dashboard-shortcut" key={item.path} onClick={() => navigate(item.path)}>
            <span className={`metric-icon-wrap ${item.tone}`}>{item.icon}</span>
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ))}
      </nav>
    </div>
  );
}

export default ManagementDashboard;
