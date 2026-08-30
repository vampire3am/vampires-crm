import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Activity,
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Coffee,
  FileText,
  FileWarning,
  History,
  LayoutDashboard,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { PhoneInput } from "../../components/ui/PhoneInput";
import { BsDateInput } from "../../components/ui/BsDateInput";
import { LeaveAllocationPicker, type LeaveAllocation } from "../../components/ui/LeaveAllocationPicker";
import { HrmsService } from "../../services/hrmsService";
import { notifyError, notifySuccess } from "../../components/common/CrmNotifications";
import { useAuth } from "../auth/AuthProvider";
import { bsMonthToAdRange, formatBsDate, formatBsMonth, todayAd, todayBs } from "../../lib/nepaliDate";

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
  joinDateRaw?: string;
  probationEndDate?: string | null;
  staffProfileId?: string | null;
  managerId?: string | null;
  dateOfBirth?: string | null;
  gender?: string;
  baseSalary: number;
  status: "ACTIVE" | "ON_LEAVE" | "PROBATION" | "SUSPENDED" | "EXITED";
  bankAccount: string;
  panNumber: string;
  ssfNumber?: string;
  citizenshipNumber?: string;
  employmentType?: string;
  paymentMethod?: string;
  currentAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
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

type LeaveType = "Annual Leave" | "Casual Leave" | "Sick Leave" | "Unpaid Leave";

interface LeaveRequest {
  id: string;
  empCode: string;
  fullName: string;
  leaveType: string;
  allocations?: LeaveAllocation[];
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  approvedBy?: string;
  approvedAt?: string;
}

interface LeavePolicy {
  leaveType: LeaveType;
  monthlyCredit: number;
  isPaid: boolean;
  allowHalfDay: boolean;
  yearEndAction: "RESET" | "CARRY_FORWARD";
  maxYearEndCarry: number | null;
}

interface LeaveBalance {
  employeeId: string;
  empCode: string;
  fullName: string;
  leaveType: LeaveType;
  monthlyCredit: number;
  opening: number;
  credited: number;
  adjusted: number;
  used: number;
  closing: number;
}

interface PayrollRecord {
  id: string;
  runId: string;
  empCode: string;
  fullName: string;
  role: string;
  month: string;
  payrollMonth: string;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  allowance: number;
  commission: number;
  grossSalary: number;
  ssfDeduction: number; // 11%
  citDeduction: number;
  tdsTax: number; // 1%
  netSalary: number;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PAID" | "CANCELLED";
  paymentDate: string;
}

interface PayrollReminderRecord {id:string;payroll_month:string;title:string;due_date:string;status:"PENDING"|"COMPLETED"|"CANCELLED";createdBy:string;created_at:string}

interface PerformanceTargetRecord { id:string;employee_id:string;title:string;description?:string;period_start:string;period_end:string;target_value:number|null;achieved_value:number;unit:string;status:string;hr_employees?:{employee_code:string;full_name:string;job_title:string} }
interface PerformanceReviewRecord { id:string;employee_id:string;review_period:string;rating:number;goals?:string;manager_feedback?:string;reviewed_at:string;hr_employees?:{employee_code:string;full_name:string;job_title:string} }
interface StaffDocumentRecord { id:string;employee_id:string;empCode:string;fullName:string;document_type:string;file_name:string;storage_path:string;expires_on?:string;status:string;created_at:string }
interface AttendanceCorrectionRecord { id:string;empCode:string;fullName:string;attendance_date:string;requested_clock_in?:string;requested_clock_out?:string;requested_status:string;reason:string;status:string }
interface ShiftRecord { id:string;name:string;start_time:string;end_time:string;grace_minutes:number;is_active:boolean }
interface SalaryComponentRecord { id:string;employee_id:string;component_type:"ALLOWANCE"|"COMMISSION"|"CIT_DEDUCTION"|"OTHER_DEDUCTION";name:string;amount:number;effective_from:string;effective_to?:string|null;is_recurring:boolean;hr_employees?:{employee_code:string;full_name:string} }
interface EmployeeActivityRecord { id:number;action:string;metadata:Record<string,unknown>;created_at:string;actor_name:string }

const INITIAL_STAFF: StaffMember[] = [];

const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

const INITIAL_LEAVES: LeaveRequest[] = [];

const INITIAL_PAYROLL: PayrollRecord[] = [];

export function HrmsWorkspace() {
  const { profile, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as "dashboard" | "staff" | "attendance" | "leaves" | "payroll" | "performance" | "documents" | null;

  const [activeTab, setActiveTab] = useState<"dashboard" | "staff" | "attendance" | "leaves" | "payroll" | "performance" | "documents">(
    tabFromUrl || "dashboard"
  );

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, activeTab]);

  const handleTabChange = (tab: "dashboard" | "staff" | "attendance" | "leaves" | "payroll" | "performance" | "documents") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const [staffList, setStaffList] = useState<StaffMember[]>(INITIAL_STAFF);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
  const [workBreaks, setWorkBreaks] = useState<WorkBreakRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>(INITIAL_LEAVES);
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>(INITIAL_PAYROLL);
  const [payrollReminders,setPayrollReminders]=useState<PayrollReminderRecord[]>([]);
  const [performanceTargets,setPerformanceTargets]=useState<PerformanceTargetRecord[]>([]);
  const [performanceReviews,setPerformanceReviews]=useState<PerformanceReviewRecord[]>([]);
  const [staffDocuments,setStaffDocuments]=useState<StaffDocumentRecord[]>([]);
  const [attendanceCorrections,setAttendanceCorrections]=useState<AttendanceCorrectionRecord[]>([]);
  const [shifts,setShifts]=useState<ShiftRecord[]>([]);
  const [salaryComponents,setSalaryComponents]=useState<SalaryComponentRecord[]>([]);
  const [employeeActivity,setEmployeeActivity]=useState<EmployeeActivityRecord[]>([]);
  const [dataError, setDataError] = useState("");
  const [myAttendance, setMyAttendance] = useState<Awaited<ReturnType<typeof HrmsService.getMyTodayAttendance>>>(null);

  const loadHrmsData = async () => {
    try {
      setDataError("");
      const [staff, attendanceRows, leaveRows, payrollRows, ownAttendance, breakRows, policies, balances, performance, documents, corrections,shiftRows,componentRows,reminderRows] = await Promise.all([
        HrmsService.getStaff(), HrmsService.getAttendance(), HrmsService.getLeaves(), HrmsService.getPayroll(), HrmsService.getMyTodayAttendance(), HrmsService.getWorkBreaks(), HrmsService.getLeavePolicies(), HrmsService.getLeaveBalances(),
        HrmsService.getPerformance(),HrmsService.getStaffDocuments(),HrmsService.getAttendanceCorrections(),HrmsService.getShifts(),HrmsService.getSalaryComponents(),HrmsService.getPayrollReminders(),
      ]);
      setStaffList(staff as StaffMember[]);
      setAttendance(attendanceRows as AttendanceRecord[]);
      setLeaves(leaveRows as LeaveRequest[]);
      setPayroll(payrollRows as PayrollRecord[]);
      setPayrollReminders(reminderRows as PayrollReminderRecord[]);
      setMyAttendance(ownAttendance);
      setWorkBreaks(breakRows as WorkBreakRecord[]);
      setLeavePolicies(policies as LeavePolicy[]);
      setLeaveBalances(balances as LeaveBalance[]);
      setPerformanceTargets(performance.targets as PerformanceTargetRecord[]);
      setPerformanceReviews(performance.reviews as PerformanceReviewRecord[]);
      setStaffDocuments(documents as StaffDocumentRecord[]);
      setAttendanceCorrections(corrections as AttendanceCorrectionRecord[]);
      setShifts(shiftRows as ShiftRecord[]);
      setSalaryComponents(componentRows as SalaryComponentRecord[]);
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
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(todayBs().slice(0,7));
  const [payrollGenerating, setPayrollGenerating] = useState(false);
  const [payrollSearch,setPayrollSearch]=useState("");
  const [showPayrollReminderModal,setShowPayrollReminderModal]=useState(false);
  const [payrollReminderForm,setPayrollReminderForm]=useState({title:"Salary processing deadline",dueDate:todayAd()});
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [employeeProfileTab,setEmployeeProfileTab]=useState<"overview"|"employment"|"salary"|"deductions"|"payroll"|"documents"|"attendance"|"leave"|"performance"|"activity">("overview");
  const [showPerformanceModal,setShowPerformanceModal]=useState(false);
  const [showDocumentModal,setShowDocumentModal]=useState(false);
  const [showCorrectionModal,setShowCorrectionModal]=useState(false);
  const [showShiftModal,setShowShiftModal]=useState(false);
  const [showEditStaffModal,setShowEditStaffModal]=useState(false);
  const [documentUploading,setDocumentUploading]=useState(false);
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
    allocations: [{ leaveType: "Casual Leave", days: 1 }] as LeaveAllocation[],
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    days: 1,
    duration: "FULL_DAY" as "FULL_DAY" | "HALF_DAY",
    reason: "",
  });
  const [performanceForm,setPerformanceForm]=useState({employeeId:"",title:"",description:"",periodStart:todayAd(),periodEnd:todayAd(),targetValue:"",unit:"COUNT"});
  const [documentForm,setDocumentForm]=useState<{employeeId:string;documentType:string;expiresOn:string;file:File|null}>({employeeId:"",documentType:"Employment Contract",expiresOn:"",file:null});
  const [correctionForm,setCorrectionForm]=useState({employeeId:"",attendanceDate:todayAd(),clockIn:"",clockOut:"",status:"PRESENT",reason:""});
  const [shiftForm,setShiftForm]=useState({employeeId:"",shiftId:"",effectiveFrom:todayAd()});
  const [editStaff,setEditStaff]=useState({id:"",fullName:"",email:"",phone:"",role:"",department:"",branch:"AECS Bagbazar Main Office",joinDate:"",probationEndDate:"",dateOfBirth:"",gender:"",currentAddress:"",emergencyContactName:"",emergencyContactPhone:"",citizenshipNumber:"",employmentType:"FULL_TIME",paymentMethod:"BANK_TRANSFER",managerId:"",baseSalary:0,bankAccount:"",panNumber:"",ssfNumber:"",status:"ACTIVE"});
  const [salaryForm,setSalaryForm]=useState({componentType:"ALLOWANCE" as SalaryComponentRecord["component_type"],name:"Housing Allowance",amount:"",effectiveFrom:todayAd(),effectiveTo:"",isRecurring:true});
  const canRequestLeave = Boolean(profile && profile.role !== "ADMIN");
  const canApproveLeave = hasPermission("hr.approve");
  const canManagePayroll = hasPermission("payroll.manage");
  const canManageHr=hasPermission("hr.manage");
  const canPreparePayroll=hasPermission("payroll.prepare")||canManagePayroll;
  const canApprovePayroll=hasPermission("payroll.approve");
  const canPayPayroll=hasPermission("payroll.pay");
  const canManagePerformance=hasPermission("performance.manage");
  const canManageHrDocuments=hasPermission("hr.documents.manage");
  const canManageAttendance=hasPermission("attendance.manage");

  const openLeaveRequest = () => {
    if (!canRequestLeave) return;
    const today=todayAd();
    setDataError("");
    setLeaveForm({empCode:myAttendance?.employeeCode??"",fullName:myAttendance?.fullName??profile?.full_name??"",allocations:[{leaveType:"Casual Leave",days:1}],fromDate:today,toDate:today,days:1,duration:"FULL_DAY",reason:""});
    setShowLeaveModal(true);
  };

  useEffect(()=>{
    if(searchParams.get("apply")!=="1"||!canRequestLeave||!myAttendance)return;
    const timer=window.setTimeout(()=>openLeaveRequest(),0);
    const next=new URLSearchParams(searchParams);next.delete("apply");next.set("tab","leaves");setSearchParams(next,{replace:true});
    return()=>window.clearTimeout(timer);
  // open exactly once after the employee profile is available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[searchParams,myAttendance,canRequestLeave]);

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
    try { await HrmsService.decideLeave(id,"APPROVED"); await loadHrmsData(); notifySuccess("Leave approved","The balance, attendance record and HR audit trail were updated."); } catch(error){setDataError(error instanceof Error?error.message:"Leave approval failed");}
  };

  const handleRejectLeave = async (id: string) => {
    try { await HrmsService.decideLeave(id,"REJECTED"); await loadHrmsData(); notifySuccess("Leave rejected","The HR decision was recorded without changing attendance or balances."); } catch(error){setDataError(error instanceof Error?error.message:"Leave rejection failed");}
  };

  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!canRequestLeave)return;
    if(!leaveForm.empCode){notifyError("Employee profile unavailable","Ask an administrator to link your login to an active HR employee record.");return}
    if(!leaveForm.fromDate||!leaveForm.toDate||new Date(leaveForm.toDate)<new Date(leaveForm.fromDate)){notifyError("Invalid leave dates","The end date must be the same as or later than the start date.");return}
    if(!leaveForm.reason.trim()){notifyError("Reason required","Add a short reason or handover note before submitting.");return}
    const allocationTotal=leaveForm.allocations.reduce((sum,item)=>sum+item.days,0);
    if(!leaveForm.allocations.length||Math.abs(allocationTotal-leaveForm.days)>0.001){notifyError("Complete the leave allocation",`Allocate exactly ${leaveForm.days.toFixed(1)} days across one or more leave categories.`);return}
    if(leaveForm.allocations.length>1&&(leaveForm.days!==1||leaveForm.fromDate!==leaveForm.toDate)){notifyError("Combined balance is for one full day","Choose one date and Full day to combine two 0.5-day balances.");return}
    try { await HrmsService.requestLeave({employee_code:leaveForm.empCode,leave_type:leaveForm.allocations[0].leaveType,allocations:leaveForm.allocations.map(item=>({leave_type:item.leaveType,days:item.days})),from_date:leaveForm.fromDate,to_date:leaveForm.toDate,duration:leaveForm.duration,reason:leaveForm.reason.trim()}); await loadHrmsData(); setShowLeaveModal(false);notifySuccess("Leave request submitted","The request is now waiting for HR approval."); }
    catch(error){const message=error instanceof Error?error.message:"Leave request failed";setDataError(message);notifyError("Leave request failed",message);}
  };

  const handleGeneratePayroll = async (event: React.FormEvent) => {
    event.preventDefault();
    setPayrollGenerating(true);
    try {
      const range=bsMonthToAdRange(payrollMonth);
      const result=await HrmsService.generatePayroll(range.start,range.end);
      await loadHrmsData();
      setShowPayrollModal(false);
      notifySuccess("Monthly payroll generated",`${result.employee_count} staff payslips were created as a draft for ${formatBsMonth(payrollMonth)}.`);
    } catch(error){const message=error instanceof Error?error.message:"Payroll could not be generated";setDataError(message);notifyError("Payroll generation failed",message);}
    finally{setPayrollGenerating(false);}
  };

  const handlePayrollTransition=async(record:PayrollRecord,status:"PENDING_APPROVAL"|"APPROVED"|"PAID")=>{
    const paymentReference=status==="PAID"?window.prompt("Enter bank batch, cheque or payment reference")??"":undefined;
    if(status==="PAID"&&!paymentReference)return;
    try{await HrmsService.transitionPayroll(record.runId,status,undefined,paymentReference);await loadHrmsData();notifySuccess("Payroll updated",`The payroll run is now ${status.replace("_"," ").toLowerCase()}.`)}catch(error){notifyError("Payroll action failed",error instanceof Error?error.message:"The payroll status could not be updated")}
  };
  const handleSavePayrollReminder=async(event:React.FormEvent)=>{event.preventDefault();try{await HrmsService.savePayrollReminder({payroll_month:payrollMonth,title:payrollReminderForm.title,due_date:payrollReminderForm.dueDate});await loadHrmsData();setShowPayrollReminderModal(false);notifySuccess("Payroll reminder scheduled",`The reminder is attached to ${formatBsMonth(payrollMonth)}.`)}catch(error){notifyError("Reminder could not be saved",error instanceof Error?error.message:"Payroll reminder failed")}};
  const handlePayrollReminderStatus=async(id:string,status:"COMPLETED"|"CANCELLED")=>{try{await HrmsService.updatePayrollReminder(id,status);await loadHrmsData();notifySuccess(status==="COMPLETED"?"Reminder completed":"Reminder cancelled","The payroll reminder status was updated.")}catch(error){notifyError("Reminder could not be updated",error instanceof Error?error.message:"Payroll reminder failed")}};

  const handleCreateTarget=async(event:React.FormEvent)=>{event.preventDefault();try{await HrmsService.savePerformanceTarget({employee_id:performanceForm.employeeId,title:performanceForm.title,description:performanceForm.description,period_start:performanceForm.periodStart,period_end:performanceForm.periodEnd,target_value:performanceForm.targetValue,unit:performanceForm.unit,status:"ACTIVE"});await loadHrmsData();setShowPerformanceModal(false);notifySuccess("Performance target assigned","The target is now visible in the employee performance record.")}catch(error){notifyError("Target could not be saved",error instanceof Error?error.message:"Performance target failed")}};

  const handleUploadStaffDocument=async(event:React.FormEvent)=>{event.preventDefault();if(!documentForm.file)return;setDocumentUploading(true);try{await HrmsService.uploadStaffDocument(documentForm.employeeId,documentForm.documentType,documentForm.file,documentForm.expiresOn);await loadHrmsData();setShowDocumentModal(false);setDocumentForm({employeeId:"",documentType:"Employment Contract",expiresOn:"",file:null});notifySuccess("Employee document secured","The private document was uploaded to the HR vault.")}catch(error){notifyError("Upload failed",error instanceof Error?error.message:"Employee document could not be uploaded")}finally{setDocumentUploading(false)}};

  const openStaffDocument=async(document:StaffDocumentRecord)=>{try{const url=await HrmsService.openStaffDocument(document.storage_path);window.open(url,"_blank","noopener,noreferrer")}catch(error){notifyError("Document unavailable",error instanceof Error?error.message:"A secure link could not be created")}};
  const handleAttendanceCorrection=async(event:React.FormEvent)=>{event.preventDefault();try{await HrmsService.requestAttendanceCorrection({employee_id:correctionForm.employeeId,attendance_date:correctionForm.attendanceDate,clock_in:correctionForm.clockIn?`${correctionForm.attendanceDate}T${correctionForm.clockIn}:00+05:45`:null,clock_out:correctionForm.clockOut?`${correctionForm.attendanceDate}T${correctionForm.clockOut}:00+05:45`:null,status:correctionForm.status,reason:correctionForm.reason});await loadHrmsData();setShowCorrectionModal(false);notifySuccess("Correction requested","The attendance change is waiting for an authorized decision.")}catch(error){notifyError("Correction failed",error instanceof Error?error.message:"The request could not be saved")}};
  const handleAssignShift=async(event:React.FormEvent)=>{event.preventDefault();try{await HrmsService.assignShift(shiftForm.employeeId,shiftForm.shiftId,shiftForm.effectiveFrom);await loadHrmsData();setShowShiftModal(false);notifySuccess("Shift assigned","The new work schedule will apply from the selected date.")}catch(error){notifyError("Shift assignment failed",error instanceof Error?error.message:"The shift could not be assigned")}};
  const employeeEditState=(staff:StaffMember)=>({id:staff.id,fullName:staff.fullName,email:staff.email,phone:staff.phone,role:staff.role,department:staff.department,branch:staff.branch,joinDate:staff.joinDateRaw??"",probationEndDate:staff.probationEndDate??"",dateOfBirth:staff.dateOfBirth??"",gender:staff.gender??"",currentAddress:staff.currentAddress??"",emergencyContactName:staff.emergencyContactName??"",emergencyContactPhone:staff.emergencyContactPhone??"",citizenshipNumber:staff.citizenshipNumber??"",employmentType:staff.employmentType??"FULL_TIME",paymentMethod:staff.paymentMethod??"BANK_TRANSFER",managerId:staff.managerId??"",baseSalary:staff.baseSalary,bankAccount:staff.bankAccount,panNumber:staff.panNumber,ssfNumber:staff.ssfNumber??"",status:staff.status});
  const openEmployeeProfile=(staff:StaffMember,tab:typeof employeeProfileTab="overview")=>{setSelectedStaff(staff);setEditStaff(employeeEditState(staff));setEmployeeProfileTab(tab);window.setTimeout(()=>document.getElementById("employee-profile-workspace")?.scrollIntoView({behavior:"smooth",block:"start"}),50)};
  const openEditStaff=(staff:StaffMember)=>{setEditStaff(employeeEditState(staff));setShowEditStaffModal(true)};
  const handleUpdateStaff=async(event:React.FormEvent)=>{event.preventDefault();try{await HrmsService.updateEmployee(editStaff.id,{full_name:editStaff.fullName,email:editStaff.email,phone:editStaff.phone,job_title:editStaff.role,department:editStaff.department,branch:editStaff.branch,join_date:editStaff.joinDate,probation_end_date:editStaff.probationEndDate,date_of_birth:editStaff.dateOfBirth,gender:editStaff.gender,current_address:editStaff.currentAddress,emergency_contact_name:editStaff.emergencyContactName,emergency_contact_phone:editStaff.emergencyContactPhone,citizenship_number:editStaff.citizenshipNumber,employment_type:editStaff.employmentType,payment_method:editStaff.paymentMethod,manager_id:editStaff.managerId,base_salary:editStaff.baseSalary,bank_account:editStaff.bankAccount,pan_number:editStaff.panNumber,ssf_number:editStaff.ssfNumber});const original=staffList.find(staff=>staff.id===editStaff.id);if(original&&original.status!==editStaff.status){const reason=editStaff.status==="EXITED"?window.prompt("Enter the employee exit reason")??"":"Status updated by HR";if(editStaff.status==="EXITED"&&!reason)return;await HrmsService.changeEmploymentStatus(editStaff.id,editStaff.status,reason)}await loadHrmsData();setSelectedStaff(current=>current?.id===editStaff.id?{...current,...staffList.find(staff=>staff.id===editStaff.id)}:current);setShowEditStaffModal(false);notifySuccess("Employee updated","Every edited profile, employment and statutory field was saved to the audit trail.")}catch(error){notifyError("Employee update failed",error instanceof Error?error.message:"Employee record could not be saved")}};
  const handleAddSalaryComponent=async(event:React.FormEvent)=>{event.preventDefault();if(!selectedStaff)return;const salaryTypes=["ALLOWANCE","COMMISSION"];const deductionTypes=["CIT_DEDUCTION","OTHER_DEDUCTION"];const componentType=employeeProfileTab==="deductions"?(deductionTypes.includes(salaryForm.componentType)?salaryForm.componentType:"CIT_DEDUCTION"):(salaryTypes.includes(salaryForm.componentType)?salaryForm.componentType:"ALLOWANCE");try{await HrmsService.saveSalaryComponent({employee_id:selectedStaff.id,component_type:componentType,name:salaryForm.name,amount:Number(salaryForm.amount),effective_from:salaryForm.effectiveFrom,effective_to:salaryForm.effectiveTo||null,is_recurring:salaryForm.isRecurring});await loadHrmsData();setSalaryForm(current=>({...current,componentType,amount:"",effectiveTo:""}));notifySuccess(employeeProfileTab==="deductions"?"Deduction updated":"Compensation updated","The component will be included in eligible future payroll runs.")}catch(error){notifyError("Component could not be saved",error instanceof Error?error.message:"Salary component failed")}};
  const handleDeleteSalaryComponent=async(id:string)=>{try{await HrmsService.deleteSalaryComponent(id);await loadHrmsData();notifySuccess("Component removed","Future payroll runs will no longer include this component.")}catch(error){notifyError("Removal failed",error instanceof Error?error.message:"Component could not be removed")}};

  useEffect(()=>{if(!selectedStaff||employeeProfileTab!=="activity")return;void HrmsService.getEmployeeActivity(selectedStaff.id).then(rows=>setEmployeeActivity(rows as EmployeeActivityRecord[])).catch(()=>setEmployeeActivity([]))},[selectedStaff,employeeProfileTab]);
  useEffect(()=>{if(!selectedStaff)return;const refreshed=staffList.find(staff=>staff.id===selectedStaff.id);if(refreshed&&refreshed!==selectedStaff)setSelectedStaff(refreshed)},[staffList,selectedStaff]);

  const updateLeaveDates=(field:"fromDate"|"toDate",value:string)=>setLeaveForm(current=>{const next={...current,[field]:value};const from=new Date(`${next.fromDate}T00:00:00`);const to=new Date(`${next.toDate}T00:00:00`);const fullDays=!Number.isNaN(from.getTime())&&!Number.isNaN(to.getTime())&&to>=from?Math.floor((to.getTime()-from.getTime())/86400000)+1:0;const days=next.duration==="HALF_DAY"?0.5:fullDays;return{...next,days,allocations:next.allocations.length===1?[{...next.allocations[0],days}]:next.allocations}});

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
  const payrollMonthRows=payroll.filter(item=>item.payrollMonth===payrollMonth&&item.status!=="CANCELLED");
  const filteredPayrollRows=payrollMonthRows.filter(item=>`${item.fullName} ${item.empCode} ${item.role}`.toLowerCase().includes(payrollSearch.toLowerCase()));
  const payrollRun=payrollMonthRows[0];
  const payrollGross=payrollMonthRows.reduce((sum,item)=>sum+item.grossSalary,0);
  const payrollDeductions=payrollMonthRows.reduce((sum,item)=>sum+item.ssfDeduction+item.citDeduction+item.tdsTax,0);
  const payrollNet=payrollMonthRows.reduce((sum,item)=>sum+item.netSalary,0);
  const payrollPaid=payrollMonthRows.filter(item=>item.status==="PAID").reduce((sum,item)=>sum+item.netSalary,0);
  const payrollPending=payrollNet-payrollPaid;
  const payrollMonths=Array.from(new Set([payrollMonth,...payroll.map(item=>item.payrollMonth).filter(Boolean)])).sort().reverse();
  const selectedPayrollReminders=payrollReminders.filter(item=>item.payroll_month===payrollMonth);
  const previewPayslip=activePayslip&&activePayslip.payrollMonth===payrollMonth?activePayslip:payrollMonthRows[0]??null;
  const todayIso = todayAd();
  const todayAttendance = attendance.filter(record => record.attendanceDate === todayIso);
  const presentToday = todayAttendance.filter(a => a.status === "PRESENT" || a.status === "LATE").length;
  const attendanceRate = staffList.length ? Math.round((presentToday / staffList.length) * 100) : 0;
  const activeStaff=staffList.filter(staff=>!["EXITED","SUSPENDED"].includes(staff.status));
  const onLeaveToday=todayAttendance.filter(record=>record.status==="ON_LEAVE").length;
  const lateToday=todayAttendance.filter(record=>record.status==="LATE").length;
  const absentToday=Math.max(0,activeStaff.length-presentToday-onLeaveToday);
  const pendingLeaves=leaves.filter(leave=>leave.status==="PENDING");
  const latestPayroll=payroll[0];
  const daysFromToday=(date:string)=>Math.ceil((new Date(`${date}T00:00:00`).getTime()-new Date(`${todayIso}T00:00:00`).getTime())/86400000);
  const upcomingProbations=staffList.filter(staff=>staff.probationEndDate&&daysFromToday(staff.probationEndDate)>=0&&daysFromToday(staff.probationEndDate)<=60).sort((a,b)=>String(a.probationEndDate).localeCompare(String(b.probationEndDate)));
  const expiringContracts=staffDocuments.filter(document=>document.document_type==="Employment Contract"&&document.expires_on&&daysFromToday(document.expires_on)>=0&&daysFromToday(document.expires_on)<=60).sort((a,b)=>String(a.expires_on).localeCompare(String(b.expires_on)));
  const attendanceRoster=activeStaff.map(staff=>({staff,record:todayAttendance.find(record=>record.employeeId===staff.id)})).slice(0,6);

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

          {canManageHr&&<button
            type="button"
            className="btn-primary"
            onClick={() => setShowAddStaffModal(true)}
          >
            <UserPlus size={16} />
            <span>Onboard Staff Member</span>
          </button>}
        </div>
      </div>

      {/* Flagship Metric Strip */}
      {activeTab!=="dashboard"&&<div className="metrics-grid-4">
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
          <span className="metric-sub">{attendanceRate}% of active employee records</span>
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
          <span className="metric-sub">Awaiting HR decision</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Monthly Payroll</span>
            <div className="metric-icon-wrap purple">
              <Wallet size={17} />
            </div>
          </div>
          <div className="metric-value">₨ {totalMonthlyPayroll.toLocaleString()}</div>
          <span className="metric-sub">Calculated from configurable company rules</span>
        </div>
      </div>}

      {activeTab==="dashboard"&&(
        <div className="hr-dashboard">
          <section className="hr-dashboard-hero">
            <div><span className="hr-dashboard-eyebrow"><LayoutDashboard size={14}/> People operations centre</span><h3>Good day, {profile?.full_name?.split(" ")[0]??"HR team"}</h3><p>A clear, live view of your workforce, approvals and payroll readiness.</p></div>
            <div className="hr-dashboard-date"><Calendar size={17}/><span><small>Today in Nepal</small><strong>{formatBsDate(todayIso)}</strong></span></div>
          </section>

          <section className="hr-dashboard-metrics" aria-label="HR summary">
            {[
              {label:"Active employees",value:activeStaff.length,detail:"Current workforce",tone:"violet",icon:<Users size={19}/>},
              {label:"Present today",value:presentToday,detail:`${attendanceRate}% attendance`,tone:"emerald",icon:<UserCheck size={19}/>},
              {label:"Absent today",value:absentToday,detail:absentToday?"Needs review":"Fully covered",tone:"rose",icon:<UserMinus size={19}/>},
              {label:"On leave",value:onLeaveToday,detail:"Approved today",tone:"orange",icon:<BriefcaseBusiness size={19}/>},
              {label:"Late arrivals",value:lateToday,detail:lateToday?"Follow-up required":"Everyone on time",tone:"blue",icon:<Clock size={19}/>},
              {label:"Leave pending",value:pendingLeaves.length,detail:pendingLeaves.length?"Awaiting HR action":"Queue is clear",tone:"amber",icon:<Calendar size={19}/>},
              {label:"Payroll status",value:latestPayroll?.status?.replace("_"," ")??"Not run",detail:latestPayroll?.month??"Current period",tone:"navy",icon:<Wallet size={19}/>},
            ].map(card=><article key={card.label} className={`hr-summary-card tone-${card.tone}`}><div className="hr-summary-icon">{card.icon}</div><div><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small></div></article>)}
          </section>

          <section className="hr-dashboard-primary-grid">
            <article className="hr-dashboard-panel">
              <header><div><span className="hr-panel-kicker">Live register</span><h4>Today’s attendance</h4></div><button type="button" onClick={()=>handleTabChange("attendance")}>View register <ArrowRight size={14}/></button></header>
              <div className="hr-dashboard-list hr-attendance-list">
                {attendanceRoster.map(({staff,record})=><button type="button" key={staff.id} className="hr-person-row" onClick={()=>setSelectedStaff(staff)}><span className="hr-person-avatar">{staff.fullName.split(" ").map(part=>part[0]).slice(0,2).join("")}</span><span className="hr-person-copy"><strong>{staff.fullName}</strong><small>{staff.role}</small></span><span className="hr-person-time">{record?.checkIn??"No punch"}<small>{record?.workedHours??"0h 0m"}</small></span><span className={`hr-state-dot state-${(record?.status??"ABSENT").toLowerCase()}`}>{record?.status?.replace("_"," ")??"ABSENT"}</span></button>)}
                {!attendanceRoster.length&&<div className="hr-dashboard-empty"><Users size={24}/><strong>No active employees</strong><span>Onboard an employee to start the daily register.</span></div>}
              </div>
              <footer><span><i className="live-indicator"/> Attendance updates automatically</span><button type="button" onClick={()=>handleTabChange("attendance")}>Open full register</button></footer>
            </article>

            <article className="hr-dashboard-panel">
              <header><div><span className="hr-panel-kicker">Approval desk</span><h4>Pending leave requests</h4></div><button type="button" onClick={()=>handleTabChange("leaves")}>View all <ArrowRight size={14}/></button></header>
              <div className="hr-dashboard-list">
                {pendingLeaves.slice(0,5).map(leave=><div className="hr-leave-row" key={leave.id}><span className="hr-person-avatar warm">{leave.fullName.split(" ").map(part=>part[0]).slice(0,2).join("")}</span><span className="hr-person-copy"><strong>{leave.fullName}</strong><small>{leave.leaveType} · {leave.days} {leave.days===1?"day":"days"}</small></span><span className="hr-leave-dates">{formatBsDate(leave.fromDate)}<small>to {formatBsDate(leave.toDate)}</small></span>{canApproveLeave&&<span className="hr-inline-actions"><button type="button" onClick={()=>void handleApproveLeave(leave.id)} aria-label={`Approve ${leave.fullName}`}><Check size={14}/></button><button type="button" onClick={()=>void handleRejectLeave(leave.id)} aria-label={`Reject ${leave.fullName}`}><X size={14}/></button></span>}</div>)}
                {!pendingLeaves.length&&<div className="hr-dashboard-empty"><Check size={25}/><strong>Approval queue is clear</strong><span>No leave requests are waiting for HR.</span></div>}
              </div>
              <footer><span>{pendingLeaves.length} request{pendingLeaves.length===1?"":"s"} awaiting decision</span><button type="button" onClick={()=>handleTabChange("leaves")}>Review requests</button></footer>
            </article>
          </section>

          <section className="hr-dashboard-secondary-grid">
            <article className="hr-dashboard-panel compact"><header><div><span className="hr-panel-kicker">Lifecycle alert</span><h4>Upcoming probation end</h4></div><button type="button" onClick={()=>handleTabChange("staff")}>Employees <ArrowRight size={14}/></button></header><div className="hr-dashboard-list">{upcomingProbations.slice(0,4).map(staff=><button type="button" className="hr-alert-row" key={staff.id} onClick={()=>openEditStaff(staff)}><span className="hr-alert-icon"><BriefcaseBusiness size={16}/></span><span><strong>{staff.fullName}</strong><small>{staff.role}</small></span><b>{daysFromToday(staff.probationEndDate!)}d<small>{formatBsDate(staff.probationEndDate!)}</small></b></button>)}{!upcomingProbations.length&&<div className="hr-dashboard-empty small"><BriefcaseBusiness size={22}/><strong>No probation deadlines</strong><span>Nothing is due in the next 60 days.</span></div>}</div></article>
            <article className="hr-dashboard-panel compact"><header><div><span className="hr-panel-kicker">Compliance alert</span><h4>Contract expiry watch</h4></div><button type="button" onClick={()=>handleTabChange("documents")}>Documents <ArrowRight size={14}/></button></header><div className="hr-dashboard-list">{expiringContracts.slice(0,4).map(document=><button type="button" className="hr-alert-row" key={document.id} onClick={()=>void openStaffDocument(document)}><span className="hr-alert-icon warning"><FileWarning size={16}/></span><span><strong>{document.fullName}</strong><small>{document.file_name}</small></span><b>{daysFromToday(document.expires_on!)}d<small>{formatBsDate(document.expires_on!)}</small></b></button>)}{!expiringContracts.length&&<div className="hr-dashboard-empty small"><FileText size={22}/><strong>No contracts expiring</strong><span>Nothing is due in the next 60 days.</span></div>}</div></article>
            <article className="hr-dashboard-panel compact hr-quick-actions"><header><div><span className="hr-panel-kicker">Shortcuts</span><h4>Quick actions</h4></div></header><div className="hr-action-grid">{canManageHr&&<button type="button" onClick={()=>setShowAddStaffModal(true)}><span className="violet"><UserPlus size={18}/></span>Add employee</button>}<button type="button" onClick={()=>handleTabChange("attendance")}><span className="emerald"><UserCheck size={18}/></span>Attendance</button><button type="button" onClick={()=>handleTabChange("leaves")}><span className="amber"><Calendar size={18}/></span>Review leave</button>{canManagePayroll&&<button type="button" onClick={()=>setShowPayrollModal(true)}><span className="rose"><Wallet size={18}/></span>Run payroll</button>}<button type="button" className="wide" onClick={()=>handleTabChange("performance")}><span className="blue"><LayoutDashboard size={18}/></span>Performance centre</button></div></article>
          </section>
        </div>
      )}

      {/* TAB 1: EMPLOYEES DIRECTORY */}
      {activeTab === "staff" && (
        <>
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
                  <th style={{ textAlign: "right" }}>Employee profile</th>
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
                        <div className="table-actions" style={{justifyContent:"flex-end"}}>{canManageHr&&<button type="button" className="btn-secondary" onClick={()=>openEditStaff(staff)}>Edit</button>}<button type="button" className="btn-secondary" onClick={() => openEmployeeProfile(staff)} style={{ padding: "7px 10px" }}>
                          <Users size={14} /> Open profile <ChevronRight size={14} />
                        </button></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {selectedStaff&&<EmployeeProfileWorkspace staff={selectedStaff} profileTab={employeeProfileTab} setProfileTab={setEmployeeProfileTab} canManageHr={canManageHr} canManageSalary={hasPermission("salary.manage")} onEdit={()=>setEmployeeProfileTab("employment")} editState={editStaff} setEditState={setEditStaff} onSaveEmployee={handleUpdateStaff} staffList={staffList} attendance={attendance} leaves={leaves} payroll={payroll} documents={staffDocuments} targets={performanceTargets} components={salaryComponents} activity={employeeActivity} salaryForm={salaryForm} setSalaryForm={setSalaryForm} onAddSalaryComponent={handleAddSalaryComponent} onDeleteSalaryComponent={handleDeleteSalaryComponent} onOpenDocument={openStaffDocument}/>}
        </>
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
            <div className="panel-header-actions"><span className="status-pill"><Clock size={13} style={{ color: "var(--accent-blue)" }} /><span>Live employee register</span></span><button type="button" className="btn-secondary" onClick={()=>setShowCorrectionModal(true)}>Request correction</button>{canManageHr&&<button type="button" className="btn-primary" onClick={()=>setShowShiftModal(true)}>Assign shift</button>}</div>
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
          <div className="panel-header-bar"><div><h3>Attendance Correction Queue</h3><p>Auditable employee requests with authorized HR decisions</p></div><span className="status-pill">{attendanceCorrections.filter(item=>item.status==="PENDING").length} pending</span></div>
          <div className="table-wrapper"><table className="crm-table"><thead><tr><th>Employee</th><th>Attendance date</th><th>Requested status</th><th>Reason</th><th>Status</th><th>Decision</th></tr></thead><tbody>{attendanceCorrections.map(item=><tr key={item.id}><td><strong>{item.fullName}</strong><small className="code-font" style={{display:"block"}}>{item.empCode}</small></td><td>{formatBsDate(item.attendance_date)}</td><td>{item.requested_status}</td><td>{item.reason}</td><td><span className={`badge-status ${item.status==="APPROVED"?"enrolled":"counselling"}`}>{item.status}</span></td><td>{item.status==="PENDING"&&canManageAttendance?<div className="table-actions"><button type="button" className="btn-secondary" onClick={async()=>{await HrmsService.decideAttendanceCorrection(item.id,"APPROVED");await loadHrmsData()}}>Approve</button><button type="button" className="btn-secondary" onClick={async()=>{await HrmsService.decideAttendanceCorrection(item.id,"REJECTED");await loadHrmsData()}}>Reject</button></div>:"—"}</td></tr>)}{!attendanceCorrections.length&&<tr><td colSpan={6} style={{textAlign:"center",padding:"28px"}}>No attendance correction requests.</td></tr>}</tbody></table></div>
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
              <p>Monthly company entitlement, employee requests and HR-only decisions</p>
            </div>
            {canRequestLeave && <button
              type="button"
              className="btn-primary"
              onClick={openLeaveRequest}
            >
              <Plus size={15} />
              <span>Apply for Leave</span>
            </button>}
          </div>

          <section className="leave-ledger" aria-labelledby="leave-ledger-heading">
            <div className="leave-ledger__header">
              <div>
                <span className="leave-ledger__eyebrow">CURRENT LEAVE YEAR</span>
                <h4 id="leave-ledger-heading">Leave Balance Ledger</h4>
                <p>Consolidated staff entitlement, monthly credit, utilisation and available balance.</p>
              </div>
              <span className="leave-ledger__scope">
                <Users size={14} /> {new Set(leaveBalances.map(item => item.employeeId)).size} employee {new Set(leaveBalances.map(item => item.employeeId)).size === 1 ? "record" : "records"}
              </span>
            </div>
            <div className="table-wrapper">
              <table className="crm-table leave-ledger__table">
                <thead>
                  <tr>
                    <th className="leave-ledger__serial">S.N.</th>
                    <th>Particular</th>
                    <th>Opening</th>
                    <th>This Month</th>
                    <th>Leave Taken</th>
                    <th>Balance</th>
                    <th>Year-End Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {[...leavePolicies].sort((a, b) => {
                    const order: LeaveType[] = ["Sick Leave", "Casual Leave", "Annual Leave", "Unpaid Leave"];
                    return order.indexOf(a.leaveType) - order.indexOf(b.leaveType);
                  }).map((policy, index) => {
                    const balances = leaveBalances.filter(item => item.leaveType === policy.leaveType);
                    const opening = balances.reduce((sum, item) => sum + item.opening, 0);
                    const credited = balances.reduce((sum, item) => sum + item.credited + item.adjusted, 0);
                    const used = balances.reduce((sum, item) => sum + item.used, 0);
                    const closing = balances.reduce((sum, item) => sum + item.closing, 0);
                    return (
                      <tr key={policy.leaveType}>
                        <td className="leave-ledger__serial">{index + 1}.</td>
                        <td>
                          <div className="leave-ledger__particular">
                            <span className={`leave-ledger__marker leave-ledger__marker--${index + 1}`} />
                            <div>
                          <strong>{policy.leaveType}</strong>
                              <small>{policy.isPaid ? `${policy.monthlyCredit} day monthly entitlement` : "Approved absence without paid entitlement"}</small>
                            </div>
                          </div>
                        </td>
                        <td><span className="leave-ledger__number">{opening.toFixed(1)}</span></td>
                        <td><span className="leave-ledger__credit">+{credited.toFixed(1)}</span></td>
                        <td><span className="leave-ledger__used">{used.toFixed(1)}</span></td>
                        <td><strong className="leave-ledger__balance">{closing.toFixed(1)}</strong></td>
                        <td>
                          <span className="leave-ledger__rule">
                            {policy.yearEndAction === "CARRY_FORWARD"
                              ? `Carry forward · max ${policy.maxYearEndCarry ?? "policy"} days`
                              : "Resets at year-end"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!leavePolicies.length && (
                    <tr><td colSpan={7} className="leave-ledger__empty">No leave policies are configured.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="leave-ledger__footer">
              <span>Balances refresh automatically after every HR decision.</span>
              <span>Figures are shown in days.</span>
            </div>
          </section>

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
                  <th style={{ textAlign: "right", width: "160px" }}>{canApproveLeave?"Approval Action":"Decision"}</th>
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
                      <span className="badge-status application">{lv.allocations?.length ? lv.allocations.map(item=>`${item.leaveType.replace(" Leave","")} ${item.days}`).join(" + ") : lv.leaveType}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px" }}>{formatBsDate(lv.fromDate)} to {formatBsDate(lv.toDate)}</span>
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
                      {lv.status === "PENDING" && canApproveLeave ? (
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
                          {lv.approvedBy ? `HR: ${lv.approvedBy}${lv.approvedAt?` · ${formatBsDate(lv.approvedAt)}`:""}` : "Awaiting HR"}
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
        <section className="payroll-workspace">
          <header className="payroll-workspace-header"><div><span className="page-category-eyebrow">Finance operations</span><h3>Payroll</h3><p>Prepare, review, approve and disburse monthly employee payroll.</p></div><div className="payroll-period-control"><Calendar size={16}/><select aria-label="Payroll month" value={payrollMonth} onChange={event=>{setPayrollMonth(event.target.value);setActivePayslip(null)}}>{payrollMonths.map(month=><option key={month} value={month}>{formatBsMonth(month)} BS</option>)}</select></div></header>

          <div className="payroll-progress" aria-label="Payroll approval workflow">{[
            {label:"Draft",status:"DRAFT",caption:payrollRun?"Complete":"Pending"},
            {label:"Reviewed",status:"PENDING_APPROVAL",caption:payrollRun&&payrollRun.status!=="DRAFT"?"Complete":"Pending"},
            {label:"Approved",status:"APPROVED",caption:["APPROVED","PAID"].includes(payrollRun?.status??"")?"Complete":"Pending"},
            {label:"Paid",status:"PAID",caption:payrollRun?.status==="PAID"?"Complete":"Pending"},
          ].map((step,index)=>{const order=["DRAFT","PENDING_APPROVAL","APPROVED","PAID"];const currentIndex=payrollRun?order.indexOf(payrollRun.status):-1;return <div key={step.status} className={`${index<=currentIndex?"complete":""} ${index===currentIndex?"current":""}`}><span>{index<currentIndex?<Check size={13}/>:index+1}</span><div><strong>{step.label}</strong><small>{step.caption}</small></div></div>})}</div>

          <div className="payroll-kpi-grid">
            <article><span className="navy"><Wallet size={18}/></span><div><small>Gross payroll</small><strong>NPR {payrollGross.toLocaleString(undefined,{minimumFractionDigits:2})}</strong><em>Before deductions</em></div></article>
            <article><span className="rose"><UserMinus size={18}/></span><div><small>Total deductions</small><strong>NPR {payrollDeductions.toLocaleString(undefined,{minimumFractionDigits:2})}</strong><em>SSF, CIT and TDS</em></div></article>
            <article><span className="emerald">Rs</span><div><small>Net payable</small><strong>NPR {payrollNet.toLocaleString(undefined,{minimumFractionDigits:2})}</strong><em>Employee disbursement</em></div></article>
            <article><span className="blue"><Users size={18}/></span><div><small>Employees processed</small><strong>{payrollMonthRows.length} / {staffList.filter(item=>["ACTIVE","PROBATION","ON_LEAVE"].includes(item.status)).length}</strong><em>{staffList.length?Math.round(payrollMonthRows.length/staffList.length*100):0}% of active staff</em></div></article>
            <article><span className="amber"><Clock size={18}/></span><div><small>Pending approval</small><strong>{payrollRun?.status==="PENDING_APPROVAL"?1:0}</strong><em>{payrollRun?.status?.replace("_"," ")??"Not generated"}</em></div></article>
          </div>

          <div className="payroll-action-bar">
            {canPreparePayroll&&<button type="button" className="btn-secondary" onClick={()=>setShowPayrollReminderModal(true)}><Clock size={15}/>Salary reminder</button>}
            {!payrollRun&&canPreparePayroll&&<button type="button" className="btn-primary payroll-run-button" onClick={()=>setShowPayrollModal(true)}><Wallet size={15}/>Run payroll</button>}
            {payrollRun?.status==="DRAFT"&&canPreparePayroll&&<button type="button" className="btn-primary" onClick={()=>void handlePayrollTransition(payrollRun,"PENDING_APPROVAL")}><Check size={15}/>Submit for review</button>}
            {payrollRun?.status==="PENDING_APPROVAL"&&canApprovePayroll&&<button type="button" className="btn-primary" onClick={()=>void handlePayrollTransition(payrollRun,"APPROVED")}><ShieldCheck size={15}/>Approve payroll</button>}
            {payrollRun?.status==="APPROVED"&&canPayPayroll&&<button type="button" className="btn-primary" onClick={()=>void handlePayrollTransition(payrollRun,"PAID")}><Wallet size={15}/>Record payment</button>}
            <button type="button" className="btn-secondary" disabled={!previewPayslip} onClick={()=>previewPayslip&&setActivePayslip(previewPayslip)}><FileText size={15}/>Generate payslips</button>
          </div>

          <div className="payroll-main-grid">
            <div className="payroll-left-column">
              <article className="payroll-card payroll-register"><header><div><h4>Payroll summary</h4><p>{formatBsMonth(payrollMonth)} BS employee register</p></div><label><Search size={14}/><input value={payrollSearch} onChange={event=>setPayrollSearch(event.target.value)} placeholder="Search employee…"/></label></header><div className="table-wrapper"><table className="crm-table"><thead><tr><th>Employee</th><th>Basic salary</th><th>Allowances</th><th>Bonus / commission</th><th>Deductions</th><th>Net salary</th><th>Status</th></tr></thead><tbody>{filteredPayrollRows.map(pay=><tr key={pay.id} className={previewPayslip?.id===pay.id?"selected":""} onClick={()=>setActivePayslip(pay)}><td><strong>{pay.fullName}</strong><small>{pay.empCode} · {pay.role}</small></td><td>NPR {pay.basicSalary.toLocaleString()}</td><td>NPR {pay.allowance.toLocaleString()}</td><td>NPR {pay.commission.toLocaleString()}</td><td className="deduction-value">− NPR {(pay.ssfDeduction+pay.citDeduction+pay.tdsTax).toLocaleString()}</td><td><strong>NPR {pay.netSalary.toLocaleString()}</strong></td><td><span className={`payroll-status status-${pay.status.toLowerCase()}`}>{pay.status.replace("_"," ")}</span></td></tr>)}{!filteredPayrollRows.length&&<tr><td colSpan={7} className="payroll-empty-state"><Wallet size={24}/><strong>{payrollMonthRows.length?"No employees match the search":"No payroll generated for this month"}</strong><span>{payrollMonthRows.length?"Clear the search to see the full register.":"Run payroll to create controlled employee drafts."}</span></td></tr>}</tbody></table></div><footer>Showing {filteredPayrollRows.length} of {payrollMonthRows.length} employees</footer></article>

              <div className="payroll-secondary-grid"><article className="payroll-card"><header><div><h4>Payroll handoff to Finance</h4><p>Approved totals and disbursement readiness</p></div></header><div className="payroll-handoff"><span><small>Handoff date</small><strong>{payrollRun?.status==="APPROVED"||payrollRun?.status==="PAID"?todayBs()+" BS":"—"}</strong></span><span><small>Total net payable</small><strong>NPR {payrollNet.toLocaleString()}</strong></span><span><small>Payment status</small><strong>{payrollRun?.status?.replace("_"," ")??"Not started"}</strong></span></div></article><article className="payroll-card"><header><div><h4>Payment summary</h4><p>Paid versus outstanding payroll</p></div></header><div className="payroll-payment-summary"><div className="payroll-donut" style={{"--paid-angle":`${payrollNet?Math.round(payrollPaid/payrollNet*360):0}deg`} as React.CSSProperties}><span>{payrollNet?Math.round(payrollPaid/payrollNet*100):0}%</span></div><dl><div><dt>Paid</dt><dd>NPR {payrollPaid.toLocaleString()}</dd></div><div><dt>Pending</dt><dd>NPR {payrollPending.toLocaleString()}</dd></div><div><dt>Total</dt><dd>NPR {payrollNet.toLocaleString()}</dd></div></dl></div></article></div>
            </div>

            <aside className="payroll-card payroll-preview"><header><div><h4>Payslip preview</h4><p>{previewPayslip?.fullName??"Select an employee"}</p></div>{previewPayslip&&<button type="button" onClick={()=>setActivePayslip(previewPayslip)}>View full</button>}</header>{previewPayslip?<div className="payroll-preview-sheet"><span className="payroll-preview-brand">AECS CRM</span><h5>Abroad Education Consultancy</h5><small>Payslip · {formatBsMonth(payrollMonth)} BS</small><dl><div><dt>Employee</dt><dd>{previewPayslip.fullName}</dd></div><div><dt>Employee ID</dt><dd>{previewPayslip.empCode}</dd></div><div><dt>Designation</dt><dd>{previewPayslip.role||"—"}</dd></div></dl><h6>Earnings</h6><dl><div><dt>Basic salary</dt><dd>{previewPayslip.basicSalary.toLocaleString()}</dd></div><div><dt>Allowances</dt><dd>{previewPayslip.allowance.toLocaleString()}</dd></div><div><dt>Commission</dt><dd>{previewPayslip.commission.toLocaleString()}</dd></div><div className="total"><dt>Gross earnings</dt><dd>{previewPayslip.grossSalary.toLocaleString()}</dd></div></dl><h6>Deductions</h6><dl><div><dt>SSF</dt><dd>{previewPayslip.ssfDeduction.toLocaleString()}</dd></div><div><dt>CIT & TDS</dt><dd>{(previewPayslip.citDeduction+previewPayslip.tdsTax).toLocaleString()}</dd></div><div className="total"><dt>Total deductions</dt><dd>{(previewPayslip.ssfDeduction+previewPayslip.citDeduction+previewPayslip.tdsTax).toLocaleString()}</dd></div></dl><div className="payroll-preview-net"><span>Net payable</span><strong>NPR {previewPayslip.netSalary.toLocaleString()}</strong></div></div>:<div className="payroll-preview-empty"><FileText size={30}/><strong>No payslip available</strong><span>Generate payroll for this month to preview employee payslips.</span></div>}</aside>
          </div>

          <article className="payroll-card payroll-reminders"><header><div><h4>Salary & payroll reminders</h4><p>Due-date alerts for HR, approvers and Finance.</p></div>{canPreparePayroll&&<button type="button" className="btn-secondary" onClick={()=>setShowPayrollReminderModal(true)}><Plus size={14}/>New reminder</button>}</header><div className="table-wrapper"><table className="crm-table"><thead><tr><th>Payroll month</th><th>Reminder</th><th>Due date</th><th>Created by</th><th>Status</th><th>Action</th></tr></thead><tbody>{selectedPayrollReminders.map(reminder=><tr key={reminder.id}><td>{formatBsMonth(reminder.payroll_month)} BS</td><td><strong>{reminder.title}</strong></td><td>{formatBsDate(reminder.due_date)}</td><td>{reminder.createdBy}</td><td><span className={`payroll-status status-${reminder.status.toLowerCase()}`}>{reminder.status}</span></td><td>{reminder.status==="PENDING"&&canPreparePayroll?<div className="table-actions"><button type="button" className="btn-secondary" onClick={()=>void handlePayrollReminderStatus(reminder.id,"COMPLETED")}>Complete</button><button type="button" className="btn-secondary" onClick={()=>void handlePayrollReminderStatus(reminder.id,"CANCELLED")}>Cancel</button></div>:"—"}</td></tr>)}{!selectedPayrollReminders.length&&<tr><td colSpan={6} className="employee-table-empty">No salary reminders for this payroll month.</td></tr>}</tbody></table></div></article>
        </section>
      )}

      {showPayrollModal&&(
        <div className="modal-backdrop-clean" onClick={()=>setShowPayrollModal(false)}>
          <div className="modal-dialog-clean payroll-generation-modal" onClick={event=>event.stopPropagation()}>
            <div className="modal-header-clean"><div><span className="page-category-eyebrow">Payroll operations</span><h3>Generate Monthly Payroll</h3><p>Create one controlled draft run for all eligible staff.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowPayrollModal(false)}><X size={18}/></button></div>
            <form onSubmit={handleGeneratePayroll}>
              <div className="modal-body-clean payroll-generation-body">
                <div className="payroll-generation-period"><Calendar size={18}/><label><span>Payroll month (BS) *</span><input required pattern="[0-9]{4}-[0-9]{2}" placeholder="2083-05" value={payrollMonth} onChange={event=>setPayrollMonth(event.target.value)}/><small>{formatBsMonth(payrollMonth)} · YYYY-MM format</small></label></div>
                <div className="payroll-generation-summary">
                  <article><span>Eligible staff</span><strong>{staffList.filter(item=>["ACTIVE","PROBATION","ON_LEAVE"].includes(item.status)).length}</strong><small>Active payroll profiles</small></article>
                  <article><span>Gross payroll</span><strong>₨ {staffList.reduce((sum,item)=>sum+item.baseSalary,0).toLocaleString()}</strong><small>Base salary before additions</small></article>
                  <article><span>SSF deduction</span><strong>11%</strong><small>Employee contribution</small></article>
                  <article><span>Income TDS</span><strong>1%</strong><small>Draft statutory deduction</small></article>
                </div>
                <div className="payroll-generation-note"><AlertCircle size={16}/><div><strong>Review before disbursement</strong><span>This creates a DRAFT only. Existing payroll for the same month cannot be generated twice.</span></div></div>
              </div>
              <div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowPayrollModal(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={payrollGenerating}>{payrollGenerating?"Generating…":`Generate for ${staffList.length} staff`}</button></div>
            </form>
          </div>
        </div>
      )}

      {showPayrollReminderModal&&<div className="modal-backdrop-clean" onClick={()=>setShowPayrollReminderModal(false)}><div className="modal-dialog-clean payroll-reminder-modal" onClick={event=>event.stopPropagation()}><div className="modal-header-clean"><div><span className="page-category-eyebrow">Payroll calendar</span><h3>Schedule Salary Reminder</h3><p>Notify payroll stakeholders about a controlled processing deadline.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowPayrollReminderModal(false)}><X size={18}/></button></div><form onSubmit={handleSavePayrollReminder}><div className="modal-body-clean"><div className="payroll-reminder-period"><Calendar size={17}/><div><span>Payroll month</span><strong>{formatBsMonth(payrollMonth)} BS</strong></div></div><div className="form-group"><label>Reminder *</label><input required minLength={3} value={payrollReminderForm.title} onChange={event=>setPayrollReminderForm(current=>({...current,title:event.target.value}))} placeholder="Example: Submit payroll for Finance review"/></div><div className="form-group"><label>Due date *</label><input required type="date" value={payrollReminderForm.dueDate} onChange={event=>setPayrollReminderForm(current=>({...current,dueDate:event.target.value}))}/><small>{formatBsDate(payrollReminderForm.dueDate)}</small></div></div><div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowPayrollReminderModal(false)}>Cancel</button><button type="submit" className="btn-primary"><Clock size={15}/>Schedule reminder</button></div></form></div></div>}

      {/* TAB 5: STAFF PERFORMANCE */}
      {activeTab === "performance" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Staff Key Performance Indicators (KPIs)</h3>
              <p>Conversion metrics, application success, and instructor student satisfaction</p>
            </div>
            {canManagePerformance&&<button type="button" className="btn-primary" onClick={()=>setShowPerformanceModal(true)}><Plus size={15}/>Assign KPI</button>}
          </div>
          <div className="table-wrapper"><table className="crm-table"><thead><tr><th>Employee</th><th>KPI / Goal</th><th>Period</th><th>Progress</th><th>Status</th></tr></thead><tbody>
            {performanceTargets.map(target=>{const percentage=target.target_value?Math.min(100,Math.round(Number(target.achieved_value)/Number(target.target_value)*100)):0;return <tr key={target.id}><td><strong>{target.hr_employees?.full_name??"Employee"}</strong><small className="code-font" style={{display:"block"}}>{target.hr_employees?.employee_code}</small></td><td><strong>{target.title}</strong><small style={{display:"block",color:"var(--text-muted)"}}>{target.description||"No description"}</small></td><td>{formatBsDate(target.period_start)} – {formatBsDate(target.period_end)}</td><td><strong>{Number(target.achieved_value).toLocaleString()} / {target.target_value==null?"—":Number(target.target_value).toLocaleString()} {target.unit}</strong><small style={{display:"block",color:"var(--text-muted)"}}>{percentage}% complete</small></td><td><span className="badge-status enrolled">{target.status}</span></td></tr>})}
            {!performanceTargets.length&&<tr><td colSpan={5} className="payroll-empty-state"><UserCheck size={24}/><strong>No performance targets assigned</strong><span>Assign a measurable KPI to begin the employee review cycle.</span></td></tr>}
          </tbody></table></div>
          {performanceReviews.length>0&&<div className="panel-header-bar"><div><h3>Completed reviews</h3><p>Manager ratings and review feedback</p></div><span className="status-pill">{performanceReviews.length} records</span></div>}
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
            <div className="panel-header-actions"><span className="status-pill">{staffDocuments.filter(document=>document.status==="VERIFIED").length} Verified</span>{canManageHrDocuments&&<button type="button" className="btn-primary" onClick={()=>setShowDocumentModal(true)}><Plus size={15}/>Upload document</button>}</div>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Emp Code</th>
                  <th>Staff Member</th>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {staffDocuments.map(document => <tr key={document.id}><td><span className="account-code-cell">{document.empCode}</span></td><td><strong>{document.fullName}</strong></td><td><button type="button" className="btn-link" onClick={()=>void openStaffDocument(document)}>{document.file_name}</button></td><td>{document.document_type}</td><td>{document.expires_on?formatBsDate(document.expires_on):"No expiry"}</td><td><span className={`badge-status ${document.status==="VERIFIED"?"enrolled":"counselling"}`}>{document.status}</span></td><td><div className="table-actions"><button type="button" className="btn-secondary" onClick={()=>void openStaffDocument(document)}>Open</button>{canManageHrDocuments&&document.status==="UPLOADED"&&<button type="button" className="btn-secondary" onClick={async()=>{await HrmsService.verifyStaffDocument(document.id,"VERIFIED");await loadHrmsData()}}>Verify</button>}</div></td></tr>)}
                {!staffDocuments.length&&<tr><td colSpan={7} className="payroll-empty-state"><FileText size={24}/><strong>No employee documents uploaded</strong><span>Upload contracts, KYC, certificates and statutory records to the private HR vault.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPerformanceModal&&<div className="modal-backdrop-clean" onClick={()=>setShowPerformanceModal(false)}><div className="modal-dialog-clean" onClick={event=>event.stopPropagation()}><div className="modal-header-clean"><div><span className="page-category-eyebrow">Performance management</span><h3>Assign Employee KPI</h3><p>Create a measurable target with a controlled review period.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowPerformanceModal(false)}><X size={18}/></button></div><form onSubmit={handleCreateTarget}><div className="modal-body-clean"><div className="form-group"><label>Employee *</label><select required value={performanceForm.employeeId} onChange={event=>setPerformanceForm(current=>({...current,employeeId:event.target.value}))}><option value="">Select employee</option>{staffList.filter(staff=>staff.status!=="EXITED").map(staff=><option key={staff.id} value={staff.id}>{staff.fullName} · {staff.empCode}</option>)}</select></div><div className="form-group"><label>KPI / goal title *</label><input required value={performanceForm.title} onChange={event=>setPerformanceForm(current=>({...current,title:event.target.value}))} placeholder="Example: Student application conversion"/></div><div className="form-group"><label>Description</label><textarea value={performanceForm.description} onChange={event=>setPerformanceForm(current=>({...current,description:event.target.value}))} placeholder="Define the expected outcome and measurement source"/></div><div className="form-row-2"><div className="form-group"><label>Period start *</label><input required type="date" value={performanceForm.periodStart} onChange={event=>setPerformanceForm(current=>({...current,periodStart:event.target.value}))}/></div><div className="form-group"><label>Period end *</label><input required type="date" value={performanceForm.periodEnd} onChange={event=>setPerformanceForm(current=>({...current,periodEnd:event.target.value}))}/></div></div><div className="form-row-2"><div className="form-group"><label>Target value *</label><input required type="number" min="0" step="0.01" value={performanceForm.targetValue} onChange={event=>setPerformanceForm(current=>({...current,targetValue:event.target.value}))}/></div><div className="form-group"><label>Measurement unit *</label><select value={performanceForm.unit} onChange={event=>setPerformanceForm(current=>({...current,unit:event.target.value}))}><option value="COUNT">Count</option><option value="PERCENT">Percent</option><option value="NPR">NPR</option><option value="SCORE">Score</option></select></div></div></div><div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowPerformanceModal(false)}>Cancel</button><button type="submit" className="btn-primary">Assign target</button></div></form></div></div>}

      {showDocumentModal&&<div className="modal-backdrop-clean" onClick={()=>setShowDocumentModal(false)}><div className="modal-dialog-clean" onClick={event=>event.stopPropagation()}><div className="modal-header-clean"><div><span className="page-category-eyebrow">Confidential HR vault</span><h3>Upload Employee Document</h3><p>Files remain private and every verification decision is permission controlled.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowDocumentModal(false)}><X size={18}/></button></div><form onSubmit={handleUploadStaffDocument}><div className="modal-body-clean"><div className="form-group"><label>Employee *</label><select required value={documentForm.employeeId} onChange={event=>setDocumentForm(current=>({...current,employeeId:event.target.value}))}><option value="">Select employee</option>{staffList.map(staff=><option key={staff.id} value={staff.id}>{staff.fullName} · {staff.empCode}</option>)}</select></div><div className="form-row-2"><div className="form-group"><label>Document type *</label><select value={documentForm.documentType} onChange={event=>setDocumentForm(current=>({...current,documentType:event.target.value}))}><option>Employment Contract</option><option>Citizenship / KYC</option><option>PAN Certificate</option><option>SSF Certificate</option><option>Academic Certificate</option><option>Experience Letter</option><option>Other</option></select></div><div className="form-group"><label>Expiry date (optional)</label><input type="date" value={documentForm.expiresOn} onChange={event=>setDocumentForm(current=>({...current,expiresOn:event.target.value}))}/></div></div><div className="form-group"><label>File *</label><input required type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" onChange={event=>setDocumentForm(current=>({...current,file:event.target.files?.[0]??null}))}/><small>PDF, JPG, PNG or DOCX · maximum 20 MB</small></div></div><div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowDocumentModal(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={documentUploading}>{documentUploading?"Uploading…":"Upload securely"}</button></div></form></div></div>}

      {showCorrectionModal&&<div className="modal-backdrop-clean" onClick={()=>setShowCorrectionModal(false)}><div className="modal-dialog-clean" onClick={event=>event.stopPropagation()}><div className="modal-header-clean"><div><span className="page-category-eyebrow">Attendance control</span><h3>Request Attendance Correction</h3><p>Every change remains pending until an authorized HR decision.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowCorrectionModal(false)}><X size={18}/></button></div><form onSubmit={handleAttendanceCorrection}><div className="modal-body-clean">{canManageAttendance&&<div className="form-group"><label>Employee *</label><select required value={correctionForm.employeeId} onChange={event=>setCorrectionForm(current=>({...current,employeeId:event.target.value}))}><option value="">Select employee</option>{staffList.map(staff=><option key={staff.id} value={staff.id}>{staff.fullName} · {staff.empCode}</option>)}</select></div>}<div className="form-row-2"><div className="form-group"><label>Attendance date *</label><input required type="date" value={correctionForm.attendanceDate} onChange={event=>setCorrectionForm(current=>({...current,attendanceDate:event.target.value}))}/></div><div className="form-group"><label>Correct status *</label><select value={correctionForm.status} onChange={event=>setCorrectionForm(current=>({...current,status:event.target.value}))}><option>PRESENT</option><option>LATE</option><option>HALF_DAY</option><option>ON_LEAVE</option><option>ABSENT</option></select></div></div><div className="form-row-2"><div className="form-group"><label>Clock in</label><input type="time" value={correctionForm.clockIn} onChange={event=>setCorrectionForm(current=>({...current,clockIn:event.target.value}))}/></div><div className="form-group"><label>Clock out</label><input type="time" value={correctionForm.clockOut} onChange={event=>setCorrectionForm(current=>({...current,clockOut:event.target.value}))}/></div></div><div className="form-group"><label>Reason *</label><textarea required value={correctionForm.reason} onChange={event=>setCorrectionForm(current=>({...current,reason:event.target.value}))} placeholder="Explain the missed or incorrect punch"/></div></div><div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowCorrectionModal(false)}>Cancel</button><button type="submit" className="btn-primary">Submit request</button></div></form></div></div>}

      {showShiftModal&&<div className="modal-backdrop-clean" onClick={()=>setShowShiftModal(false)}><div className="modal-dialog-clean" onClick={event=>event.stopPropagation()}><div className="modal-header-clean"><div><span className="page-category-eyebrow">Work schedule</span><h3>Assign Employee Shift</h3><p>Existing open assignments close automatically on the new effective date.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowShiftModal(false)}><X size={18}/></button></div><form onSubmit={handleAssignShift}><div className="modal-body-clean"><div className="form-group"><label>Employee *</label><select required value={shiftForm.employeeId} onChange={event=>setShiftForm(current=>({...current,employeeId:event.target.value}))}><option value="">Select employee</option>{staffList.filter(staff=>staff.status!=="EXITED").map(staff=><option key={staff.id} value={staff.id}>{staff.fullName} · {staff.empCode}</option>)}</select></div><div className="form-group"><label>Shift *</label><select required value={shiftForm.shiftId} onChange={event=>setShiftForm(current=>({...current,shiftId:event.target.value}))}><option value="">Select active shift</option>{shifts.filter(shift=>shift.is_active).map(shift=><option key={shift.id} value={shift.id}>{shift.name} · {shift.start_time.slice(0,5)}–{shift.end_time.slice(0,5)} · {shift.grace_minutes}m grace</option>)}</select></div><div className="form-group"><label>Effective from *</label><input required type="date" value={shiftForm.effectiveFrom} onChange={event=>setShiftForm(current=>({...current,effectiveFrom:event.target.value}))}/></div></div><div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowShiftModal(false)}>Cancel</button><button type="submit" className="btn-primary">Assign shift</button></div></form></div></div>}

      {showEditStaffModal&&<div className="modal-backdrop-clean" onClick={()=>setShowEditStaffModal(false)}><div className="modal-dialog-clean" onClick={event=>event.stopPropagation()}><div className="modal-header-clean"><div><span className="page-category-eyebrow">Employee master</span><h3>Edit Employee Record</h3><p>Maintain identity, employment, payroll and statutory details.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowEditStaffModal(false)}><X size={18}/></button></div><form onSubmit={handleUpdateStaff}><div className="modal-body-clean"><div className="form-row-2"><div className="form-group"><label>Full legal name *</label><input required value={editStaff.fullName} onChange={event=>setEditStaff(current=>({...current,fullName:event.target.value}))}/></div><div className="form-group"><label>Employment status *</label><select value={editStaff.status} onChange={event=>setEditStaff(current=>({...current,status:event.target.value}))}><option>ACTIVE</option><option>PROBATION</option><option>ON_LEAVE</option><option>SUSPENDED</option><option>EXITED</option></select></div></div><div className="form-row-2"><div className="form-group"><label>Email *</label><input required type="email" value={editStaff.email} onChange={event=>setEditStaff(current=>({...current,email:event.target.value}))}/></div><div className="form-group"><label>Phone</label><input value={editStaff.phone} onChange={event=>setEditStaff(current=>({...current,phone:event.target.value}))}/></div></div><div className="form-row-2"><div className="form-group"><label>Designation *</label><input required value={editStaff.role} onChange={event=>setEditStaff(current=>({...current,role:event.target.value}))}/></div><div className="form-group"><label>Department *</label><select value={editStaff.department} onChange={event=>setEditStaff(current=>({...current,department:event.target.value}))}><option>Management</option><option>Counselling</option><option>Admissions</option><option>Academic</option><option>Finance</option><option>HR &amp; Admin</option></select></div></div><div className="form-row-2"><div className="form-group"><label>Base salary (NPR) *</label><input required type="number" min="0" value={editStaff.baseSalary} onChange={event=>setEditStaff(current=>({...current,baseSalary:Number(event.target.value)}))}/></div><div className="form-group"><label>Bank account</label><input value={editStaff.bankAccount} onChange={event=>setEditStaff(current=>({...current,bankAccount:event.target.value}))}/></div></div><div className="form-row-2"><div className="form-group"><label>PAN number</label><input value={editStaff.panNumber} onChange={event=>setEditStaff(current=>({...current,panNumber:event.target.value}))}/></div><div className="form-group"><label>SSF number</label><input value={editStaff.ssfNumber} onChange={event=>setEditStaff(current=>({...current,ssfNumber:event.target.value}))}/></div></div></div><div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowEditStaffModal(false)}>Cancel</button><button type="submit" className="btn-primary">Save employee record</button></div></form></div></div>}

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
      {showLeaveModal && canRequestLeave && (
        <div className="modal-backdrop-clean" onClick={() => setShowLeaveModal(false)}>
          <div className="modal-dialog-clean" onClick={e => e.stopPropagation()}>
            <div className="modal-header-clean">
              <div>
                <h3>Apply for Leave</h3>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  BS-dated request sent directly to HR for approval or rejection
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
                    <div className="hrms-self-applicant"><UserCheck size={16}/><div><strong>{leaveForm.fullName||"Employee profile unavailable"}</strong><span>{leaveForm.empCode||"No employee code linked"}</span></div></div>
                  </div>

                  <div className="form-group">
                    <label>Duration *</label>
                    <select value={leaveForm.duration} onChange={e=>setLeaveForm(current=>{const duration=e.target.value as "FULL_DAY"|"HALF_DAY";const days=duration==="HALF_DAY"?0.5:Math.max(1,current.days);return{...current,duration,toDate:duration==="HALF_DAY"?current.fromDate:current.toDate,days,allocations:[{leaveType:current.allocations[0]?.leaveType??"Casual Leave",days}]}})}>
                      <option value="FULL_DAY">Full day</option>
                      <option value="HALF_DAY">Half day (0.5)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>From Date (BS) *</label>
                    <BsDateInput required value={leaveForm.fromDate} onChange={value => updateLeaveDates("fromDate",value)} ariaLabel="Leave start date in BS" />
                  </div>
                  <div className="form-group">
                    <label>To Date (BS) *</label>
                    <BsDateInput required disabled={leaveForm.duration==="HALF_DAY"} value={leaveForm.toDate} onChange={value => updateLeaveDates("toDate",value)} ariaLabel="Leave end date in BS" />
                  </div>
                </div>

                <div className="hrms-leave-duration"><Calendar size={16}/><span>Requested duration</span><strong>{leaveForm.days||0} {leaveForm.days===1?"day":"days"}</strong></div>

                <LeaveAllocationPicker policies={leavePolicies} balances={leaveBalances.filter(item=>item.empCode===leaveForm.empCode)} requestedDays={leaveForm.days} value={leaveForm.allocations} onChange={allocations=>setLeaveForm(current=>({...current,allocations}))}/>

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

      {selectedStaff && activeTab!=="staff" && (() => {
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

type EmployeeProfileTab="overview"|"employment"|"salary"|"deductions"|"payroll"|"documents"|"attendance"|"leave"|"performance"|"activity";
type SalaryFormState={componentType:SalaryComponentRecord["component_type"];name:string;amount:string;effectiveFrom:string;effectiveTo:string;isRecurring:boolean};
type EmployeeEditState={id:string;fullName:string;email:string;phone:string;role:string;department:string;branch:string;joinDate:string;probationEndDate:string;dateOfBirth:string;gender:string;currentAddress:string;emergencyContactName:string;emergencyContactPhone:string;citizenshipNumber:string;employmentType:string;paymentMethod:string;managerId:string;baseSalary:number;bankAccount:string;panNumber:string;ssfNumber:string;status:string};

function EmployeeProfileWorkspace({staff,profileTab,setProfileTab,canManageHr,canManageSalary,onEdit,editState,setEditState,onSaveEmployee,staffList,attendance,leaves,payroll,documents,targets,components,activity,salaryForm,setSalaryForm,onAddSalaryComponent,onDeleteSalaryComponent,onOpenDocument}:{staff:StaffMember;profileTab:EmployeeProfileTab;setProfileTab:(tab:EmployeeProfileTab)=>void;canManageHr:boolean;canManageSalary:boolean;onEdit:()=>void;editState:EmployeeEditState;setEditState:React.Dispatch<React.SetStateAction<EmployeeEditState>>;onSaveEmployee:(event:React.FormEvent)=>void;staffList:StaffMember[];attendance:AttendanceRecord[];leaves:LeaveRequest[];payroll:PayrollRecord[];documents:StaffDocumentRecord[];targets:PerformanceTargetRecord[];components:SalaryComponentRecord[];activity:EmployeeActivityRecord[];salaryForm:SalaryFormState;setSalaryForm:React.Dispatch<React.SetStateAction<SalaryFormState>>;onAddSalaryComponent:(event:React.FormEvent)=>void;onDeleteSalaryComponent:(id:string)=>void;onOpenDocument:(document:StaffDocumentRecord)=>void}){
  const initials=staff.fullName.split(" ").map(part=>part[0]).slice(0,2).join("").toUpperCase();
  const manager=staffList.find(item=>item.id===staff.managerId);
  const staffAttendance=attendance.filter(item=>item.employeeId===staff.id);
  const staffLeaves=leaves.filter(item=>item.empCode===staff.empCode);
  const staffPayroll=payroll.filter(item=>item.empCode===staff.empCode);
  const staffDocuments=documents.filter(item=>item.employee_id===staff.id);
  const staffTargets=targets.filter(item=>item.employee_id===staff.id);
  const staffComponents=components.filter(item=>item.employee_id===staff.id);
  const additions=staffComponents.filter(item=>item.component_type==="ALLOWANCE"||item.component_type==="COMMISSION");
  const deductions=staffComponents.filter(item=>item.component_type==="CIT_DEDUCTION"||item.component_type==="OTHER_DEDUCTION");
  const recurringAdditions=additions.filter(item=>item.is_recurring).reduce((sum,item)=>sum+Number(item.amount),0);
  const packageTotal=staff.baseSalary+recurringAdditions;
  const tabs:{id:EmployeeProfileTab;label:string;icon:React.ReactNode}[]=[
    {id:"overview",label:"Overview",icon:<Users size={14}/>},{id:"employment",label:"Employment",icon:<BriefcaseBusiness size={14}/>},{id:"salary",label:"Salary",icon:<BadgeDollarSign size={14}/>},{id:"deductions",label:"Deductions",icon:<ShieldCheck size={14}/>},{id:"payroll",label:"Payroll",icon:<Wallet size={14}/>},{id:"documents",label:"Documents",icon:<FileText size={14}/>},{id:"attendance",label:"Attendance",icon:<Clock size={14}/>},{id:"leave",label:"Leave",icon:<Calendar size={14}/>},{id:"performance",label:"Performance",icon:<LayoutDashboard size={14}/>},{id:"activity",label:"Activity",icon:<Activity size={14}/>},
  ];
  const detail=(label:string,value:React.ReactNode)=><div className="employee-detail-item"><span>{label}</span><strong>{value||"—"}</strong></div>;
  return <section className="employee-profile-workspace" id="employee-profile-workspace">
    <header className="employee-profile-hero"><div className="employee-profile-identity"><span className="employee-profile-avatar">{initials}</span><div><span className="employee-profile-code">{staff.empCode}</span><h3>{staff.fullName}</h3><p>{staff.role} · {staff.department} · {staff.branch}</p></div></div><div className="employee-profile-actions"><span className={`employee-status status-${staff.status.toLowerCase()}`}><i/>{staff.status.replace("_"," ")}</span>{canManageHr&&<button type="button" className="btn-primary" onClick={onEdit}>Edit complete profile</button>}</div></header>
    <div className="employee-profile-kpis"><article><span>Employment</span><strong>{staff.employmentType?.replace("_"," ")??"Full time"}</strong><small>Since {staff.joinDate}</small></article><article><span>Attendance records</span><strong>{staffAttendance.length}</strong><small>{staffAttendance.filter(item=>item.status==="LATE").length} late arrivals</small></article><article><span>Leave requests</span><strong>{staffLeaves.length}</strong><small>{staffLeaves.filter(item=>item.status==="PENDING").length} awaiting decision</small></article><article><span>Performance goals</span><strong>{staffTargets.length}</strong><small>{staffTargets.filter(item=>item.status==="ACTIVE").length} active targets</small></article><article><span>Current package</span><strong>₨ {packageTotal.toLocaleString()}</strong><small>Basic plus recurring additions</small></article></div>
    <div className="employee-profile-body"><nav className="employee-profile-nav"><span>Employee workspace</span>{tabs.map(tab=><button type="button" key={tab.id} className={profileTab===tab.id?"active":""} onClick={()=>setProfileTab(tab.id)}>{tab.icon}<span>{tab.label}</span></button>)}</nav><main className="employee-profile-content">
      {profileTab==="overview"&&<><div className="employee-section-heading"><div><span>Employee profile</span><h4>Personal overview</h4><p>Identity, contact, statutory and reporting information.</p></div>{canManageHr&&<button type="button" className="btn-secondary" onClick={onEdit}>Edit overview</button>}</div><div className="employee-detail-grid"><section><h5>Personal details</h5>{detail("Work email",staff.email)}{detail("Phone",staff.phone)}{detail("Date of birth",staff.dateOfBirth?formatBsDate(staff.dateOfBirth):"—")}{detail("Gender",staff.gender)}{detail("Current address",staff.currentAddress)}{detail("Emergency contact",[staff.emergencyContactName,staff.emergencyContactPhone].filter(Boolean).join(" · "))}</section><section><h5>Employment snapshot</h5>{detail("Department",staff.department)}{detail("Designation",staff.role)}{detail("Reporting manager",manager?.fullName??"Not assigned")}{detail("Joining date",staff.joinDate)}{detail("Probation end",staff.probationEndDate?formatBsDate(staff.probationEndDate):"—")}{detail("Employment type",staff.employmentType?.replace("_"," "))}</section><section><h5>Statutory identity</h5>{detail("Citizenship",staff.citizenshipNumber)}{detail("PAN number",staff.panNumber)}{detail("SSF number",staff.ssfNumber)}{detail("Bank account",staff.bankAccount)}{detail("Payment method",staff.paymentMethod?.replace("_"," "))}{detail("Linked CRM account",staff.staffProfileId?"Connected":"Not connected")}</section></div></>}
      {profileTab==="employment"&&<><div className="employee-section-heading"><div><span>Employment lifecycle</span><h4>Role, reporting and work arrangement</h4><p>All employment fields can be maintained from one controlled record.</p></div>{canManageHr&&<button type="button" className="btn-primary" onClick={onEdit}>Edit employment</button>}</div><div className="employee-employment-card"><div className="employee-employment-timeline"><span className="complete"><i/><b>Joined AECS</b><small>{staff.joinDate}</small></span><span className={staff.probationEndDate?"complete":"pending"}><i/><b>Probation review</b><small>{staff.probationEndDate?formatBsDate(staff.probationEndDate):"Not scheduled"}</small></span><span className={staff.status==="ACTIVE"?"current":"pending"}><i/><b>Current employment</b><small>{staff.status.replace("_"," ")}</small></span></div><div className="employee-detail-grid two"><section>{detail("Employee code",staff.empCode)}{detail("Employment type",staff.employmentType?.replace("_"," "))}{detail("Department",staff.department)}{detail("Designation",staff.role)}</section><section>{detail("Branch",staff.branch)}{detail("Reporting manager",manager?.fullName??"Not assigned")}{detail("Joining date",staff.joinDate)}{detail("Current status",staff.status.replace("_"," "))}</section></div></div></>}
      {profileTab==="salary"&&<CompensationTab title="Salary & additions" subtitle="Basic salary, recurring allowances and commissions used by payroll." staff={staff} packageTotal={packageTotal} components={additions} canManage={canManageSalary} salaryForm={salaryForm} setSalaryForm={setSalaryForm} onSubmit={onAddSalaryComponent} onDelete={onDeleteSalaryComponent} mode="additions" onEditBasic={onEdit}/>}
      {profileTab==="deductions"&&<CompensationTab title="Deductions & statutory withholding" subtitle="CIT and other payroll deductions maintained separately from earnings." staff={staff} packageTotal={deductions.reduce((sum,item)=>sum+Number(item.amount),0)} components={deductions} canManage={canManageSalary} salaryForm={salaryForm} setSalaryForm={setSalaryForm} onSubmit={onAddSalaryComponent} onDelete={onDeleteSalaryComponent} mode="deductions" onEditBasic={onEdit}/>}
      {profileTab==="payroll"&&<><div className="employee-section-heading"><div><span>Payroll history</span><h4>Payslips and disbursement status</h4><p>Immutable monthly payroll records for this employee.</p></div></div><div className="table-wrapper"><table className="crm-table"><thead><tr><th>Period</th><th>Basic</th><th>Additions</th><th>Deductions</th><th>Net salary</th><th>Status</th></tr></thead><tbody>{staffPayroll.map(item=><tr key={item.id}><td>{item.month}</td><td>₨ {item.basicSalary.toLocaleString()}</td><td>₨ {(item.allowance+item.commission).toLocaleString()}</td><td>₨ {(item.ssfDeduction+item.citDeduction+item.tdsTax).toLocaleString()}</td><td><strong>₨ {item.netSalary.toLocaleString()}</strong></td><td><span className="badge-status enrolled">{item.status}</span></td></tr>)}{!staffPayroll.length&&<tr><td colSpan={6} className="employee-table-empty">No payroll has been generated for this employee.</td></tr>}</tbody></table></div></>}
      {profileTab==="documents"&&<><div className="employee-section-heading"><div><span>Private HR vault</span><h4>Employee documents</h4><p>Contracts, identity, statutory and qualification records.</p></div></div><div className="employee-record-cards">{staffDocuments.map(document=><button type="button" key={document.id} onClick={()=>onOpenDocument(document)}><span><FileText size={18}/></span><div><strong>{document.file_name}</strong><small>{document.document_type} · {document.status}</small></div><ArrowRight size={14}/></button>)}{!staffDocuments.length&&<div className="employee-table-empty">No employee documents uploaded.</div>}</div></>}
      {profileTab==="attendance"&&<><div className="employee-section-heading"><div><span>Daily register</span><h4>Attendance history</h4><p>Punch time, worked hours and late arrival history.</p></div></div><div className="table-wrapper"><table className="crm-table"><thead><tr><th>Date</th><th>Clock in</th><th>Clock out</th><th>Worked</th><th>Late</th><th>Status</th></tr></thead><tbody>{staffAttendance.map(item=><tr key={item.id}><td>{item.date}</td><td>{item.checkIn}</td><td>{item.checkOut}</td><td>{item.workedHours}</td><td>{item.lateMinutes?`${item.lateMinutes} min`:"On time"}</td><td><span className="badge-status enrolled">{item.status}</span></td></tr>)}{!staffAttendance.length&&<tr><td colSpan={6} className="employee-table-empty">No attendance records.</td></tr>}</tbody></table></div></>}
      {profileTab==="leave"&&<><div className="employee-section-heading"><div><span>Leave history</span><h4>Requests and decisions</h4><p>Employee leave applications with HR decision status.</p></div></div><div className="table-wrapper"><table className="crm-table"><thead><tr><th>Type</th><th>Date range</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead><tbody>{staffLeaves.map(item=><tr key={item.id}><td>{item.leaveType}</td><td>{formatBsDate(item.fromDate)} – {formatBsDate(item.toDate)}</td><td>{item.days}</td><td>{item.reason}</td><td><span className="badge-status enrolled">{item.status}</span></td></tr>)}{!staffLeaves.length&&<tr><td colSpan={5} className="employee-table-empty">No leave requests.</td></tr>}</tbody></table></div></>}
      {profileTab==="performance"&&<><div className="employee-section-heading"><div><span>Performance centre</span><h4>Goals and measured outcomes</h4><p>Authorized performance targets for this employee.</p></div></div><div className="employee-record-cards">{staffTargets.map(target=><div className="employee-target-card" key={target.id}><span><History size={17}/></span><div><strong>{target.title}</strong><small>{formatBsDate(target.period_start)} – {formatBsDate(target.period_end)}</small></div><b>{Number(target.achieved_value)} / {target.target_value??"—"} {target.unit}</b></div>)}{!staffTargets.length&&<div className="employee-table-empty">No performance goals assigned.</div>}</div></>}
      {profileTab==="activity"&&<><div className="employee-section-heading"><div><span>Audit history</span><h4>Employee activity trail</h4><p>Accountable changes made by authorized CRM users.</p></div></div><div className="employee-activity-list">{activity.map(item=><article key={item.id}><span><Activity size={14}/></span><div><strong>{item.action.replaceAll("_"," ")}</strong><small>{item.actor_name} · {new Date(item.created_at).toLocaleString("en-GB",{timeZone:"Asia/Kathmandu"})}</small></div></article>)}{!activity.length&&<div className="employee-table-empty">No audited employee changes recorded yet.</div>}</div></>}
      {profileTab==="employment"&&canManageHr&&<EmployeeCompleteEditForm value={editState} onChange={setEditState} onSubmit={onSaveEmployee} staffList={staffList}/>}
    </main></div>
  </section>
}

function CompensationTab({title,subtitle,staff,packageTotal,components,canManage,salaryForm,setSalaryForm,onSubmit,onDelete,mode,onEditBasic}:{title:string;subtitle:string;staff:StaffMember;packageTotal:number;components:SalaryComponentRecord[];canManage:boolean;salaryForm:SalaryFormState;setSalaryForm:React.Dispatch<React.SetStateAction<SalaryFormState>>;onSubmit:(event:React.FormEvent)=>void;onDelete:(id:string)=>void;mode:"additions"|"deductions";onEditBasic:()=>void}){
  const isDeductions=mode==="deductions";
  const allowedTypes:SalaryComponentRecord["component_type"][]=isDeductions?["CIT_DEDUCTION","OTHER_DEDUCTION"]:["ALLOWANCE","COMMISSION"];
  const selectType=(value:SalaryComponentRecord["component_type"])=>setSalaryForm(current=>({...current,componentType:value,name:value==="ALLOWANCE"?"Housing Allowance":value==="COMMISSION"?"Performance Commission":value==="CIT_DEDUCTION"?"CIT Deduction":"Other Deduction"}));
  return <><div className="employee-section-heading"><div><span>{isDeductions?"Payroll withholding":"Compensation"}</span><h4>{title}</h4><p>{subtitle}</p></div>{canManage&&<button type="button" className="btn-secondary" onClick={onEditBasic}>Edit basic salary</button>}</div><div className={`employee-compensation-hero ${isDeductions?"deduction":""}`}><span>{isDeductions?"ACTIVE MONTHLY DEDUCTIONS":"CURRENT MONTHLY PACKAGE"}</span><strong>₨ {packageTotal.toLocaleString()}</strong><small>{isDeductions?`${components.length} configured deduction records`:`₨ ${staff.baseSalary.toLocaleString()} basic + active recurring additions`}</small></div>{canManage&&<form className="employee-component-form" onSubmit={onSubmit}><div className="form-group"><label>Component type *</label><select value={allowedTypes.includes(salaryForm.componentType)?salaryForm.componentType:allowedTypes[0]} onChange={event=>selectType(event.target.value as SalaryComponentRecord["component_type"])}>{allowedTypes.map(type=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></div><div className="form-group"><label>Name *</label><input required value={salaryForm.name} onChange={event=>setSalaryForm(current=>({...current,name:event.target.value}))}/></div><div className="form-group"><label>Amount (NPR) *</label><input required type="number" min="0" step="0.01" value={salaryForm.amount} onChange={event=>setSalaryForm(current=>({...current,amount:event.target.value}))}/></div><div className="form-group"><label>Effective from *</label><input required type="date" value={salaryForm.effectiveFrom} onChange={event=>setSalaryForm(current=>({...current,effectiveFrom:event.target.value}))}/></div><div className="form-group"><label>Effective until</label><input type="date" value={salaryForm.effectiveTo} onChange={event=>setSalaryForm(current=>({...current,effectiveTo:event.target.value}))}/></div><label className="employee-recurring-check"><input type="checkbox" checked={salaryForm.isRecurring} onChange={event=>setSalaryForm(current=>({...current,isRecurring:event.target.checked}))}/><span>Recurring monthly</span></label><button type="submit" className="btn-primary">Add {isDeductions?"deduction":"component"}</button></form>}<div className="employee-component-list">{components.map(component=><article key={component.id}><span className={isDeductions?"deduction":"addition"}>{isDeductions?"−":"+"}</span><div><strong>{component.name}</strong><small>{component.component_type.replaceAll("_"," ")} · {component.is_recurring?"Recurring":"One-time"} · Effective {formatBsDate(component.effective_from)}</small></div><b>₨ {Number(component.amount).toLocaleString()}</b>{canManage&&<button type="button" onClick={()=>onDelete(component.id)} aria-label={`Remove ${component.name}`}><Trash2 size={14}/></button>}</article>)}{!components.length&&<div className="employee-table-empty">No {isDeductions?"deductions":"allowances or commissions"} configured.</div>}</div></>
}

function EmployeeCompleteEditForm({value,onChange,onSubmit,staffList}:{value:EmployeeEditState;onChange:React.Dispatch<React.SetStateAction<EmployeeEditState>>;onSubmit:(event:React.FormEvent)=>void;staffList:StaffMember[]}){
  const set=(field:keyof EmployeeEditState,next:string|number)=>onChange(current=>({...current,[field]:next}));
  return <form className="employee-complete-edit" onSubmit={onSubmit}><header><div><span>Complete profile editor</span><h5>Edit every employee field</h5><p>Changes are permission-controlled and added to the employee audit trail.</p></div><button type="submit" className="btn-primary">Save complete profile</button></header><section><h6>Identity & contact</h6><div className="employee-edit-grid"><label><span>Full legal name *</span><input required value={value.fullName} onChange={event=>set("fullName",event.target.value)}/></label><label><span>Work email *</span><input required type="email" value={value.email} onChange={event=>set("email",event.target.value)}/></label><label><span>Phone</span><input value={value.phone} onChange={event=>set("phone",event.target.value)}/></label><label><span>Date of birth</span><input type="date" value={value.dateOfBirth} onChange={event=>set("dateOfBirth",event.target.value)}/></label><label><span>Gender</span><select value={value.gender} onChange={event=>set("gender",event.target.value)}><option value="">Not specified</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select></label><label className="wide"><span>Current address</span><input value={value.currentAddress} onChange={event=>set("currentAddress",event.target.value)}/></label><label><span>Emergency contact name</span><input value={value.emergencyContactName} onChange={event=>set("emergencyContactName",event.target.value)}/></label><label><span>Emergency contact phone</span><input value={value.emergencyContactPhone} onChange={event=>set("emergencyContactPhone",event.target.value)}/></label></div></section><section><h6>Employment & reporting</h6><div className="employee-edit-grid"><label><span>Designation *</span><input required value={value.role} onChange={event=>set("role",event.target.value)}/></label><label><span>Department *</span><select value={value.department} onChange={event=>set("department",event.target.value)}><option>Management</option><option>Counselling</option><option>Admissions</option><option>Academic</option><option>Finance</option><option>HR &amp; Admin</option></select></label><label><span>Branch *</span><input required value={value.branch} onChange={event=>set("branch",event.target.value)}/></label><label><span>Employment type *</span><select value={value.employmentType} onChange={event=>set("employmentType",event.target.value)}><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="INTERN">Intern</option><option value="CONSULTANT">Consultant</option></select></label><label><span>Joining date *</span><input required type="date" value={value.joinDate} onChange={event=>set("joinDate",event.target.value)}/></label><label><span>Probation end</span><input type="date" value={value.probationEndDate} onChange={event=>set("probationEndDate",event.target.value)}/></label><label><span>Reporting manager</span><select value={value.managerId} onChange={event=>set("managerId",event.target.value)}><option value="">Not assigned</option>{staffList.filter(staff=>staff.id!==value.id&&staff.status!=="EXITED").map(staff=><option key={staff.id} value={staff.id}>{staff.fullName} · {staff.role}</option>)}</select></label><label><span>Employment status *</span><select value={value.status} onChange={event=>set("status",event.target.value)}><option>ACTIVE</option><option>PROBATION</option><option>ON_LEAVE</option><option>SUSPENDED</option><option>EXITED</option></select></label></div></section><section><h6>Salary, bank & statutory</h6><div className="employee-edit-grid"><label><span>Basic salary (NPR) *</span><input required type="number" min="0" value={value.baseSalary} onChange={event=>set("baseSalary",Number(event.target.value))}/></label><label><span>Payment method</span><select value={value.paymentMethod} onChange={event=>set("paymentMethod",event.target.value)}><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="CHEQUE">Cheque</option></select></label><label><span>Bank account</span><input value={value.bankAccount} onChange={event=>set("bankAccount",event.target.value)}/></label><label><span>Citizenship number</span><input value={value.citizenshipNumber} onChange={event=>set("citizenshipNumber",event.target.value)}/></label><label><span>PAN number</span><input value={value.panNumber} onChange={event=>set("panNumber",event.target.value)}/></label><label><span>SSF number</span><input value={value.ssfNumber} onChange={event=>set("ssfNumber",event.target.value)}/></label></div></section><footer><span><ShieldCheck size={15}/> Every change is recorded in Activity.</span><button type="submit" className="btn-primary">Save complete profile</button></footer></form>
}

export default HrmsWorkspace;
