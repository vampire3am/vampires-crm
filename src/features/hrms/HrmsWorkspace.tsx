import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Coffee,
  FileText,
  Plus,
  Printer,
  Receipt,
  Search,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { PhoneInput } from "../../components/ui/PhoneInput";
import { HrmsService } from "../../services/hrmsService";

interface StaffMember {
  id: string;
  empCode: string;
  fullName: string;
  role: string;
  department: "Management" | "Counselling" | "Admissions" | "Academic" | "Finance" | "HR & Admin";
  branch: "AECS Bagbazar Main Office";
  email: string;
  phone: string;
  joinDate: string;
  baseSalary: number;
  status: "ACTIVE" | "ON_LEAVE" | "PROBATION";
  bankAccount: string;
  panNumber: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  empCode: string;
  fullName: string;
  attendanceDate: string;
  date: string;
  checkIn: string;
  checkOut: string;
  workedHours: string;
  status: "PRESENT" | "LATE" | "HALF_DAY" | "ON_LEAVE" | "ABSENT";
  lateMinutes?: number;
}

interface WorkBreakRecord {
  id: string;
  empCode: string;
  fullName: string;
  source: "AUTOMATIC" | "MANUAL";
  startedLabel: string;
  duration: string;
  status: "ACTIVE" | "COMPLETED";
}

interface LeaveRequest {
  id: string;
  empCode: string;
  fullName: string;
  leaveType: "Annual Leave" | "Casual Leave" | "Sick / Medical" | "Maternity / Paternity" | "Festival Leave";
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  approvedBy?: string;
}

interface PayrollRecord {
  id: string;
  empCode: string;
  fullName: string;
  role: string;
  month: string;
  basicSalary: number;
  allowance: number;
  commission: number;
  grossSalary: number;
  ssfDeduction: number; // 11%
  citDeduction: number;
  tdsTax: number; // 1%
  netSalary: number;
  status: "PAID" | "PROCESSING";
  paymentDate: string;
}

const INITIAL_STAFF: StaffMember[] = [];

const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

const INITIAL_LEAVES: LeaveRequest[] = [];

const INITIAL_PAYROLL: PayrollRecord[] = [];

export function HrmsWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as "staff" | "attendance" | "leaves" | "payroll" | "performance" | "documents" | null;

  const [activeTab, setActiveTab] = useState<"staff" | "attendance" | "leaves" | "payroll" | "performance" | "documents">(
    tabFromUrl || "staff"
  );

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, activeTab]);

  const handleTabChange = (tab: "staff" | "attendance" | "leaves" | "payroll" | "performance" | "documents") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const [staffList, setStaffList] = useState<StaffMember[]>(INITIAL_STAFF);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
  const [workBreaks, setWorkBreaks] = useState<WorkBreakRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>(INITIAL_LEAVES);
  const [payroll, setPayroll] = useState<PayrollRecord[]>(INITIAL_PAYROLL);
  const [dataError, setDataError] = useState("");
  const [myAttendance, setMyAttendance] = useState<Awaited<ReturnType<typeof HrmsService.getMyTodayAttendance>>>(null);

  const loadHrmsData = async () => {
    try {
      setDataError("");
      const [staff, attendanceRows, leaveRows, payrollRows, ownAttendance, breakRows] = await Promise.all([
        HrmsService.getStaff(), HrmsService.getAttendance(), HrmsService.getLeaves(), HrmsService.getPayroll(), HrmsService.getMyTodayAttendance(), HrmsService.getWorkBreaks(),
      ]);
      setStaffList(staff as StaffMember[]);
      setAttendance(attendanceRows as AttendanceRecord[]);
      setLeaves(leaveRows as LeaveRequest[]);
      setPayroll(payrollRows as PayrollRecord[]);
      setMyAttendance(ownAttendance);
      setWorkBreaks(breakRows as WorkBreakRecord[]);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "HRMS records could not be loaded");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHrmsData();
  }, []);

  const [staffSearch, setStaffSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [activePayslip, setActivePayslip] = useState<PayrollRecord | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [clockInSuccess, setClockInSuccess] = useState(false);
  const [clockOutSuccess, setClockOutSuccess] = useState(false);

  // New Staff Form
  const [newStaff, setNewStaff] = useState({
    fullName: "",
    role: "Education Counsellor",
    department: "Counselling" as StaffMember["department"],
    branch: "AECS Bagbazar Main Office" as StaffMember["branch"],
    email: "",
    phone: "",
    baseSalary: 0,
    bankAccount: "",
    panNumber: "",
  });

  // New Leave Form
  const [leaveForm, setLeaveForm] = useState({
    empCode: "",
    fullName: "",
    leaveType: "Casual Leave" as LeaveRequest["leaveType"],
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    days: 1,
    reason: "",
  });

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.fullName.trim()) return;

    try {
      await HrmsService.createEmployee({full_name:newStaff.fullName,email:newStaff.email,phone:newStaff.phone,job_title:newStaff.role,department:newStaff.department,branch:newStaff.branch,join_date:new Date().toISOString().slice(0,10),base_salary:Number(newStaff.baseSalary),bank_account:newStaff.bankAccount,pan_number:newStaff.panNumber});
      await loadHrmsData(); setShowAddStaffModal(false);
    } catch(error){setDataError(error instanceof Error?error.message:"Employee could not be created");}
  };

  const handleClockIn = async () => {
    if (myAttendance?.clockIn) { setDataError("Today's clock-in is already recorded."); return; }
    try { await HrmsService.clockIn(); await loadHrmsData(); setClockInSuccess(true); setTimeout(() => setClockInSuccess(false), 3000); }
    catch(error){setDataError(error instanceof Error?error.message:"Clock-in failed");}
  };

  const handleClockOut = async () => {
    if (!myAttendance?.clockIn) { setDataError("Clock in before ending your shift."); return; }
    if (myAttendance.clockOut) { setDataError("Today's shift is already completed."); return; }
    try { await HrmsService.clockOut(); await loadHrmsData(); setClockOutSuccess(true); setTimeout(() => setClockOutSuccess(false), 3000); }
    catch(error){setDataError(error instanceof Error?error.message:"Clock-out failed");}
  };

  const handleApproveLeave = async (id: string) => {
    try { await HrmsService.decideLeave(id,"APPROVED"); await loadHrmsData(); } catch(error){setDataError(error instanceof Error?error.message:"Leave approval failed");}
  };

  const handleRejectLeave = async (id: string) => {
    try { await HrmsService.decideLeave(id,"REJECTED"); await loadHrmsData(); } catch(error){setDataError(error instanceof Error?error.message:"Leave rejection failed");}
  };

  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await HrmsService.requestLeave({employee_code:leaveForm.empCode,leave_type:leaveForm.leaveType,from_date:leaveForm.fromDate,to_date:leaveForm.toDate,days:Number(leaveForm.days),reason:leaveForm.reason||"Personal matter"}); await loadHrmsData(); setShowLeaveModal(false); }
    catch(error){setDataError(error instanceof Error?error.message:"Leave request failed");}
  };

  const filteredStaff = staffList.filter(s => {
    const matchesDept = deptFilter === "ALL" || s.department === deptFilter;
    const matchesSearch =
      s.fullName.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.empCode.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.role.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(staffSearch.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const totalMonthlyPayroll = payroll.reduce((sum, p) => sum + p.netSalary, 0);
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.filter(record => record.attendanceDate === todayIso);

  return (
    <div className="page-container">
      {dataError&&<div className="dashboard-error-banner" role="alert"><AlertCircle size={18}/><div><strong>Attendance action unavailable</strong><span>{dataError}</span></div><button type="button" onClick={() => setDataError("")}>Dismiss</button></div>}
      {/* Header Row */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>HRMS, Attendance & Payroll Portal</h2>
          <p>
            Employee master directory, biometric attendance clock-in, leave approval workflow, and monthly payroll execution.
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClockIn}
            disabled={Boolean(myAttendance?.clockIn)}
          >
            {clockInSuccess ? <Check size={15} style={{ color: "var(--success)" }} /> : <Clock size={15} />}
            <span>{clockInSuccess ? "Clocked In Successfully!" : myAttendance?.clockIn ? "Clock-In Recorded" : "Web Clock-In (Today)"}</span>
          </button>

          <button type="button" className="btn-secondary" onClick={handleClockOut} disabled={!myAttendance?.clockIn || Boolean(myAttendance?.clockOut)}>
            {clockOutSuccess ? <Check size={15} style={{ color: "var(--success)" }} /> : <Clock size={15} />}
            <span>{clockOutSuccess ? "Clocked Out Successfully!" : myAttendance?.clockOut ? "Shift Completed" : "Web Clock-Out"}</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowAddStaffModal(true)}
          >
            <UserPlus size={16} />
            <span>Onboard Staff Member</span>
          </button>
        </div>
      </div>

      {/* Flagship Metric Strip */}
      <div className="metrics-grid-4">
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Staff Strength</span>
            <div className="metric-icon-wrap blue">
              <Users size={17} />
            </div>
          </div>
          <div className="metric-value">{staffList.length} Active</div>
          <span className="metric-sub">Across KTM & Pokhara hubs</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Today's Attendance</span>
            <div className="metric-icon-wrap green">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="metric-value">
            {todayAttendance.filter(a => a.status === "PRESENT" || a.status === "LATE").length} Present
          </div>
          <span className="metric-sub">91.6% punctuality clearance</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Pending Leaves</span>
            <div className="metric-icon-wrap amber">
              <Clock size={17} />
            </div>
          </div>
          <div className="metric-value">
            {leaves.filter(l => l.status === "PENDING").length} Requests
          </div>
          <span className="metric-sub">Awaiting management approval</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Monthly Payroll</span>
            <div className="metric-icon-wrap purple">
              <Wallet size={17} />
            </div>
          </div>
          <div className="metric-value">₨ {totalMonthlyPayroll.toLocaleString()}</div>
          <span className="metric-sub">SSF, CIT & 1% TDS Compliant</span>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="document-tabs">
        <button
          className={activeTab === "staff" ? "active" : ""}
          onClick={() => handleTabChange("staff")}
        >
          <Users size={16} />
          <span>Employees ({staffList.length})</span>
        </button>
        <button
          className={activeTab === "attendance" ? "active" : ""}
          onClick={() => handleTabChange("attendance")}
        >
          <Clock size={16} />
          <span>Attendance</span>
        </button>
        <button
          className={activeTab === "leaves" ? "active" : ""}
          onClick={() => handleTabChange("leaves")}
        >
          <Calendar size={16} />
          <span>Leave Requests ({leaves.filter(l => l.status === "PENDING").length})</span>
        </button>
        <button
          className={activeTab === "payroll" ? "active" : ""}
          onClick={() => handleTabChange("payroll")}
        >
          <Receipt size={16} />
          <span>Payroll</span>
        </button>
        <button
          className={activeTab === "performance" ? "active" : ""}
          onClick={() => handleTabChange("performance")}
        >
          <TrendingUp size={16} />
          <span>Performance</span>
        </button>
        <button
          className={activeTab === "documents" ? "active" : ""}
          onClick={() => handleTabChange("documents")}
        >
          <FileText size={16} />
          <span>HR Documents</span>
        </button>
      </div>

      {/* TAB 1: EMPLOYEES DIRECTORY */}
      {activeTab === "staff" && (
        <div className="crm-panel">
          <div className="filter-toolbar">
            <div className="search-input-wrap" style={{ width: "340px" }}>
              <Search size={16} />
              <input
                type="text"
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                placeholder="Search staff by name, code, designation…"
              />
            </div>

            <div className="toolbar-selects">
              <select
                className="crm-select"
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                <option value="Management">Management</option>
                <option value="Counselling">Counselling</option>
                <option value="Admissions">Admissions & Visa</option>
                <option value="Academic">Academic & Test Prep</option>
                <option value="Finance">Finance & Accounts</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: "135px" }}>Emp Code</th>
                  <th>Staff Member</th>
                  <th>Designation / Role</th>
                  <th>Department</th>
                  <th>Branch Hub</th>
                  <th>Contact Info</th>
                  <th>Base Gross</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(staff => {
                  const initials = staff.fullName
                    .split(" ")
                    .map(n => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr key={staff.id}>
                      <td>
                        <span className="account-code-cell">{staff.empCode}</span>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                            }}
                          >
                            {initials}
                          </div>
                          <div className="student-name-cell">
                            <strong style={{ fontSize: "13px" }}>{staff.fullName}</strong>
                            <small>Joined: {staff.joinDate}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <strong style={{ fontSize: "12.5px" }}>{staff.role}</strong>
                      </td>

                      <td>
                        <span className="badge-status application">{staff.department}</span>
                      </td>

                      <td>
                        <span style={{ fontSize: "12px", color: "var(--text-main)", fontWeight: 500 }}>
                          {staff.branch}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                          <span>{staff.phone}</span>
                          <span style={{ display: "block" }}>{staff.email}</span>
                        </div>
                      </td>

                      <td>
                        <strong className="code-font" style={{ fontSize: "12.5px" }}>
                          ₨ {staff.baseSalary.toLocaleString()}
                        </strong>
                      </td>

                      <td>
                        <span className="badge-status enrolled">
                          {staff.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button type="button" className="btn-secondary" onClick={() => setSelectedStaff(staff)} style={{ padding: "7px 10px" }}>
                          <Clock size={14} /> View log <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE */}
      {activeTab === "attendance" && (
        <div className="hrms-attendance-stack">
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Daily Biometric & Web Attendance Log</h3>
              <p>Real-time clock-in records for the AECS Bagbazar Main Office</p>
            </div>
            <span className="status-pill">
              <Clock size={13} style={{ color: "var(--accent-blue)" }} />
              <span>Shift: 09:00 AM – 06:00 PM · Present cutoff 10:15 AM</span>
            </span>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Emp Code</th>
                  <th>Staff Member</th>
                  <th>Attendance Date</th>
                  <th>Punch-In Time</th>
                  <th>Punch-Out Time</th>
                  <th>Worked Hours</th>
                  <th>Late Arrival</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(att => (
                  <tr key={att.id}>
                    <td>
                      <span className="account-code-cell">{att.empCode}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: "13px" }}>{att.fullName}</strong>
                    </td>
                    <td>{att.date}</td>
                    <td>
                      <span className="code-font" style={{ fontWeight: 700, color: "var(--accent-blue)" }}>
                        {att.checkIn}
                      </span>
                    </td>
                    <td>{att.checkOut}</td>
                    <td><strong className="code-font">{att.workedHours}</strong></td>
                    <td>
                      {att.lateMinutes ? (
                        <span style={{ color: "var(--danger)", fontWeight: 700, fontSize: "11.5px" }}>
                          +{att.lateMinutes} mins late
                        </span>
                      ) : (
                        <span style={{ color: "var(--success-text)", fontSize: "11.5px" }}>On Time</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge-status ${att.status === "PRESENT" ? "enrolled" : att.status === "LATE" ? "counselling" : "new-lead"}`}>
                        {att.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div><h3>Screen-Time Break Audit</h3><p>Automatic 60-minute prompts and employee-initiated five-minute breaks</p></div>
            <span className="status-pill"><Coffee size={13} /><span>60 min work · 5 min recovery</span></span>
          </div>
          <div className="table-wrapper"><table className="crm-table">
            <thead><tr><th>Emp Code</th><th>Staff Member</th><th>Break Started</th><th>Trigger</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
              {workBreaks.map(item => <tr key={item.id}><td><span className="account-code-cell">{item.empCode}</span></td><td><strong>{item.fullName}</strong></td><td>{item.startedLabel}</td><td><span className="status-pill">{item.source === "AUTOMATIC" ? "Scheduled prompt" : "Manual break"}</span></td><td><strong className="code-font">{item.duration}</strong></td><td><span className={`badge-status ${item.status === "COMPLETED" ? "enrolled" : "counselling"}`}>{item.status}</span></td></tr>)}
              {!workBreaks.length && <tr><td colSpan={6} style={{ textAlign:"center", padding:"28px" }}>No screen-time breaks have been recorded yet.</td></tr>}
            </tbody>
          </table></div>
        </div>
        </div>
      )}

      {/* TAB 3: LEAVES */}
      {activeTab === "leaves" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Staff Leave Management & Approval Queue</h3>
              <p>Formal requests for annual, sick, casual, and festival leaves in Nepal</p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowLeaveModal(true)}
            >
              <Plus size={15} />
              <span>Apply for Leave</span>
            </button>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Emp Code</th>
                  <th>Staff Member</th>
                  <th>Leave Type</th>
                  <th>Date Range</th>
                  <th>Duration</th>
                  <th>Reason & Remarks</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right", width: "160px" }}>Maker-Checker Action</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map(lv => (
                  <tr key={lv.id}>
                    <td>
                      <span className="account-code-cell">{lv.empCode}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: "13px" }}>{lv.fullName}</strong>
                    </td>
                    <td>
                      <span className="badge-status application">{lv.leaveType}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px" }}>{lv.fromDate} to {lv.toDate}</span>
                    </td>
                    <td>
                      <strong>{lv.days} {lv.days === 1 ? "Day" : "Days"}</strong>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "260px" }}>
                      {lv.reason}
                    </td>
                    <td>
                      <span className={`badge-status ${lv.status === "APPROVED" ? "enrolled" : lv.status === "PENDING" ? "counselling" : "visa"}`}>
                        {lv.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {lv.status === "PENDING" ? (
                        <div className="table-actions" style={{ justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: "3px 8px", fontSize: "11px", color: "var(--success)" }}
                            onClick={() => handleApproveLeave(lv.id)}
                          >
                            <Check size={12} />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: "3px 8px", fontSize: "11px", color: "var(--danger)" }}
                            onClick={() => handleRejectLeave(lv.id)}
                          >
                            <X size={12} />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {lv.approvedBy ? `Approved by ${lv.approvedBy}` : "Completed"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PAYROLL & SALARY VOUCHERS */}
      {activeTab === "payroll" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Monthly Payroll Register & Statutory Deductions</h3>
              <p>Compliant with Nepal Social Security Fund (SSF), CIT & 1% Income Tax TDS</p>
            </div>
            <span className="status-pill">Fiscal Month: Shrawan 2083</span>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Emp Code</th>
                  <th>Staff Member</th>
                  <th>Designation</th>
                  <th>Gross Salary</th>
                  <th>SSF (11%)</th>
                  <th>CIT & TDS</th>
                  <th>Net Disbursed (NPR)</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right", width: "130px" }}>Payslip Voucher</th>
                </tr>
              </thead>
              <tbody>
                {payroll.map(pay => (
                  <tr key={pay.id} onClick={() => setActivePayslip(pay)} style={{ cursor: "pointer" }}>
                    <td>
                      <span className="account-code-cell">{pay.empCode}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: "13px" }}>{pay.fullName}</strong>
                    </td>
                    <td>{pay.role}</td>
                    <td>
                      <strong className="code-font">₨ {pay.grossSalary.toLocaleString()}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "var(--danger)" }}>-₨ {pay.ssfDeduction.toLocaleString()}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "var(--danger)" }}>-₨ {(pay.citDeduction + pay.tdsTax).toLocaleString()}</span>
                    </td>
                    <td>
                      <strong className="code-font" style={{ fontSize: "13.5px", color: "var(--success-text)" }}>
                        ₨ {pay.netSalary.toLocaleString()}
                      </strong>
                    </td>
                    <td>
                      <span className="badge-status enrolled">{pay.status}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: "3px 8px", fontSize: "11px" }}
                        onClick={e => {
                          e.stopPropagation();
                          setActivePayslip(pay);
                        }}
                      >
                        <FileText size={13} />
                        <span>Print Payslip</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: STAFF PERFORMANCE */}
      {activeTab === "performance" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Staff Key Performance Indicators (KPIs)</h3>
              <p>Conversion metrics, application success, and instructor student satisfaction</p>
            </div>
            <span className="status-pill">Q1 FY 2026/27</span>
          </div>

          <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ padding: "18px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span className="account-code-cell">COUNSELLING LEADERSHIP</span>
                <span className="badge-status enrolled">94% Target SLA</span>
              </div>
              <strong style={{ fontSize: "14px", display: "block" }}>No performance records</strong>
              <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", fontSize: "12px" }}>
                <div><span style={{ color: "var(--text-muted)" }}>Assigned Leads:</span> <strong>0</strong></div>
                <div><span style={{ color: "var(--text-muted)" }}>Enrolled Offers:</span> <strong>0</strong></div>
                <div><span style={{ color: "var(--text-muted)" }}>Conversion:</span> <strong>—</strong></div>
              </div>
            </div>

            <div style={{ padding: "18px", background: "var(--bg-card-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span className="account-code-cell">VISA SCRUTINY ACCURACY</span>
                <span className="badge-status enrolled">98% Success</span>
              </div>
              <strong style={{ fontSize: "14px", display: "block" }}>No visa performance records</strong>
              <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", fontSize: "12px" }}>
                <div><span style={{ color: "var(--text-muted)" }}>Files Lodged:</span> <strong>0</strong></div>
                <div><span style={{ color: "var(--text-muted)" }}>Visas Granted:</span> <strong>0</strong></div>
                <div><span style={{ color: "var(--text-muted)" }}>Grant Rate:</span> <strong>—</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: HR DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Employee Statutory Documents & Contracts</h3>
              <p>Employment agreements, citizenship copies, academic certificates, and PAN / SSF records</p>
            </div>
            <span className="status-pill">0 Staff Verified</span>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Emp Code</th>
                  <th>Staff Member</th>
                  <th>Employment Contract</th>
                  <th>Citizenship / KYC</th>
                  <th>PAN & SSF Certificate</th>
                  <th>Compliance Status</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map(s => (
                  <tr key={s.id}>
                    <td><span className="account-code-cell">{s.empCode}</span></td>
                    <td><strong>{s.fullName}</strong></td>
                    <td><span className="badge-status enrolled">Signed PDF</span></td>
                    <td><span className="badge-status enrolled">Verified Copy</span></td>
                    <td><span className="badge-status enrolled">PAN {s.panNumber}</span></td>
                    <td><span className="badge-status enrolled">100% Compliant</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONBOARD STAFF MODAL */}
      {showAddStaffModal && (
        <div className="modal-backdrop-clean" onClick={() => setShowAddStaffModal(false)}>
          <div className="modal-dialog-clean" onClick={e => e.stopPropagation()}>
            <div className="modal-header-clean">
              <div>
                <h3>Onboard New AECS Staff Member</h3>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  Assign official role, branch hub, base gross salary, and bank details
                </p>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowAddStaffModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff}>
              <div className="modal-body-clean">
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      value={newStaff.fullName}
                      onChange={e => setNewStaff({ ...newStaff, fullName: e.target.value })}
                      placeholder="Employee name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Assigned Role *</label>
                    <select
                      value={newStaff.role}
                      onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                    >
                      <option value="Senior Education Counsellor">Senior Education Counsellor</option>
                      <option value="Education Counsellor">Education Counsellor</option>
                      <option value="Visa & Compliance Officer">Visa & Compliance Officer</option>
                      <option value="Documentation Officer">Documentation Officer</option>
                      <option value="IELTS / PTE Instructor">IELTS / PTE Instructor</option>
                      <option value="Finance & Billing Officer">Finance & Billing Officer</option>
                      <option value="Front Desk Officer">Front Desk Officer</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Department *</label>
                    <select
                      value={newStaff.department}
                      onChange={e => setNewStaff({ ...newStaff, department: e.target.value as StaffMember["department"] })}
                    >
                      <option value="Counselling">Counselling</option>
                      <option value="Admissions">Admissions & Visa</option>
                      <option value="Academic">Academic & Test Prep</option>
                      <option value="Finance">Finance & Accounts</option>
                      <option value="Management">Management</option>
                      <option value="HR & Admin">HR & Admin</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Operating Branch *</label>
                    <select
                      value={newStaff.branch}
                      onChange={e => setNewStaff({ ...newStaff, branch: e.target.value as StaffMember["branch"] })}
                    >
                      <option value="AECS Bagbazar Main Office">AECS Bagbazar Main Office</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Official Email *</label>
                    <input
                      type="email"
                      required
                      value={newStaff.email}
                      onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                      placeholder="staff@aecsnepal.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Mobile Number *</label>
                    <PhoneInput
                      required
                      value={newStaff.phone}
                      onChange={val => setNewStaff({ ...newStaff, phone: val })}
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Base Gross Salary (NPR) *</label>
                    <input
                      type="number"
                      required
                      min="20000"
                      step="1000"
                      value={newStaff.baseSalary}
                      onChange={e => setNewStaff({ ...newStaff, baseSalary: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Bank Account Number *</label>
                    <input
                      type="text"
                      required
                      value={newStaff.bankAccount}
                      onChange={e => setNewStaff({ ...newStaff, bankAccount: e.target.value })}
                      placeholder="Nabil Bank · XXXXXXXXXXXX"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer-clean">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddStaffModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <UserPlus size={15} />
                  <span>Complete Staff Onboarding</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPLY LEAVE MODAL */}
      {showLeaveModal && (
        <div className="modal-backdrop-clean" onClick={() => setShowLeaveModal(false)}>
          <div className="modal-dialog-clean" onClick={e => e.stopPropagation()}>
            <div className="modal-header-clean">
              <div>
                <h3>Apply for Leave</h3>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  Submit request to Management for Maker-Checker approval
                </p>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowLeaveModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRequestLeave}>
              <div className="modal-body-clean">
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Applicant Staff *</label>
                    <select
                      value={`${leaveForm.empCode}|${leaveForm.fullName}`}
                      onChange={e => {
                        const [code, name] = e.target.value.split("|");
                        setLeaveForm({ ...leaveForm, empCode: code, fullName: name });
                      }}
                    >
                      {staffList.map(s => (
                        <option key={s.id} value={`${s.empCode}|${s.fullName}`}>
                          {s.fullName} ({s.empCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Leave Category *</label>
                    <select
                      value={leaveForm.leaveType}
                      onChange={e => setLeaveForm({ ...leaveForm, leaveType: e.target.value as LeaveRequest["leaveType"] })}
                    >
                      <option value="Annual Leave">Annual Leave</option>
                      <option value="Casual Leave">Casual Leave</option>
                      <option value="Sick / Medical">Sick / Medical</option>
                      <option value="Festival Leave">Festival Leave</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>From Date *</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.fromDate}
                      onChange={e => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>To Date *</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.toDate}
                      onChange={e => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Reason / Handover Notes *</label>
                  <textarea
                    required
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="State reason for absence and active case handovers…"
                  />
                </div>
              </div>

              <div className="modal-footer-clean">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowLeaveModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Calendar size={15} />
                  <span>Submit Leave Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL PRINTABLE PAYSLIP MODAL */}
      {activePayslip && (
        <div className="modal-backdrop-clean" onClick={() => setActivePayslip(null)}>
          <div
            className="modal-dialog-clean"
            style={{ maxWidth: "600px", background: "#FFFFFF", color: "#0F172A" }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                padding: "24px",
                borderBottom: "1px dashed #CBD5E1",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <img src="/abroad-logo-new.png" alt="AECS" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
                  <strong style={{ fontSize: "14px", color: "#0B1E3B" }}>Abroad Education Consultancy Services</strong>
                </div>
                <p style={{ fontSize: "11px", color: "#64748B" }}>
                  Adwait Marga, Purano Buspark, Bagbazar, Kathmandu · PAN/VAT: <strong>Configure in Settings</strong>
                </p>
              </div>
              <span className="status-pill" style={{ background: "#ECFDF5", color: "#047857", borderColor: "#A7F3D0" }}>
                SALARY PAYSLIP
              </span>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Employee Name</span>
                  <strong style={{ fontSize: "13.5px" }}>{activePayslip.fullName}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Employee Code / ID</span>
                  <span className="code-font" style={{ fontWeight: 700, color: "#F97316" }}>{activePayslip.empCode}</span>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Designation</span>
                  <strong>{activePayslip.role}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Pay Period</span>
                  <strong>{activePayslip.month}</strong>
                </div>
              </div>

              <div style={{ border: "1px solid #E2E8F0", borderRadius: "6px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "#64748B" }}>Earnings Item</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", color: "#64748B" }}>Amount (NPR)</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "#64748B" }}>Statutory Deductions</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", color: "#64748B" }}>Amount (NPR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 12px" }}>Basic Salary</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>₨ {activePayslip.basicSalary.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px" }}>Social Security (SSF 11%)</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#DC2626" }}>-₨ {activePayslip.ssfDeduction.toLocaleString()}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 12px" }}>Allowances</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>₨ {activePayslip.allowance.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px" }}>Citizen Investment (CIT)</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#DC2626" }}>-₨ {activePayslip.citDeduction.toLocaleString()}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 12px" }}>Incentives & Commissions</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>₨ {activePayslip.commission.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px" }}>1% Income Tax TDS</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#DC2626" }}>-₨ {activePayslip.tdsTax.toLocaleString()}</td>
                    </tr>
                    <tr style={{ background: "#F8FAFC", borderTop: "2px solid #CBD5E1" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 800 }}>Gross Total</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800 }}>₨ {activePayslip.grossSalary.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 800, color: "#047857" }}>Net Disbursed Pay</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#047857", fontSize: "13.5px" }}>
                        ₨ {activePayslip.netSalary.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748B", paddingTop: "10px" }}>
                <span>Disbursement: <strong>Bank Direct Deposit</strong></span>
                <span>Payment Date: <strong>{activePayslip.paymentDate}</strong></span>
              </div>
            </div>

            <div className="modal-footer-clean" style={{ background: "#F8FAFC" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActivePayslip(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>Print Official Payslip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStaff && (() => {
        const records = attendance.filter(row => row.empCode === selectedStaff.empCode);
        const presentDays = records.filter(row => row.status === "PRESENT" || row.status === "LATE").length;
        const lateDays = records.filter(row => row.status === "LATE").length;
        return (
          <div className="modal-backdrop-clean" onClick={() => setSelectedStaff(null)}>
            <div className="modal-dialog-clean" style={{ maxWidth: "780px" }} onClick={event => event.stopPropagation()}>
              <div className="modal-header-clean">
                <div>
                  <span className="page-category-eyebrow">Employee attendance profile</span>
                  <h3>{selectedStaff.fullName}</h3>
                  <p>{selectedStaff.empCode} · {selectedStaff.role} · {selectedStaff.branch}</p>
                </div>
                <button type="button" className="drawer-close-btn" onClick={() => setSelectedStaff(null)} aria-label="Close attendance profile"><X size={18} /></button>
              </div>
              <div className="modal-body-clean">
                <div className="metrics-grid-4" style={{ marginBottom: "18px" }}>
                  <div className="metric-box"><span className="metric-label">Recorded days</span><div className="metric-value">{records.length}</div></div>
                  <div className="metric-box"><span className="metric-label">Present days</span><div className="metric-value">{presentDays}</div></div>
                  <div className="metric-box"><span className="metric-label">Late arrivals</span><div className="metric-value">{lateDays}</div></div>
                  <div className="metric-box"><span className="metric-label">Attendance rate</span><div className="metric-value">{records.length ? Math.round((presentDays / records.length) * 100) : 0}%</div></div>
                </div>
                <div className="table-wrapper">
                  <table className="crm-table">
                    <thead><tr><th>Date</th><th>Clock in</th><th>Clock out</th><th>Worked</th><th>Late</th><th>Status</th></tr></thead>
                    <tbody>
                      {records.map(row => <tr key={row.id}><td>{row.date}</td><td>{row.checkIn}</td><td>{row.checkOut}</td><td><strong>{row.workedHours}</strong></td><td>{row.lateMinutes ? `${row.lateMinutes} min` : "On time"}</td><td><span className={`badge-status ${row.status === "PRESENT" ? "enrolled" : row.status === "LATE" ? "counselling" : "new-lead"}`}>{row.status}</span></td></tr>)}
                      {!records.length && <tr><td colSpan={6} style={{ textAlign: "center", padding: "28px" }}>No attendance has been recorded for this employee yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={() => setSelectedStaff(null)}>Close</button><button type="button" className="btn-primary" onClick={() => { setSelectedStaff(null); handleTabChange("attendance"); }}><Clock size={15} /> Open full attendance register</button></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default HrmsWorkspace;
