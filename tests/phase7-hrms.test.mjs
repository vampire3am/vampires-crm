import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync("supabase/migrations/202608210017_phase7_hrms.sql","utf8");
const policySql=readFileSync("supabase/migrations/202608280003_hrms_leave_policy_engine.sql","utf8");
const allocationSql=readFileSync("supabase/migrations/202608280004_mixed_leave_allocations.sql","utf8");
const payrollSql=readFileSync("supabase/migrations/202608280005_payroll_generation.sql","utf8");
const operationsSql=readFileSync("supabase/migrations/202608280007_complete_hrms_operations.sql","utf8");
const payrollNotificationsSql=readFileSync("supabase/migrations/202608280008_hrms_payroll_notifications.sql","utf8");
const employeeWorkspaceSql=readFileSync("supabase/migrations/202608280009_employee_profile_workspace.sql","utf8");
const payrollWorkspaceSql=readFileSync("supabase/migrations/202608280010_payroll_workspace.sql","utf8");
const hrmsUi=readFileSync("src/features/hrms/HrmsWorkspace.tsx","utf8");
const shellUi=readFileSync("src/components/layout/AppShell.tsx","utf8");
for(const table of ["hr_employees","hr_shifts","hr_shift_assignments","hr_attendance","hr_leave_requests","hr_payroll_runs","hr_payroll_items","hr_performance_reviews","hr_staff_documents"]){assert.match(sql,new RegExp(`create table public\\.${table}\\b`));}
for(const fn of ["hr_create_employee","hr_clock_in","hr_request_leave","hr_decide_leave"]){assert.match(sql,new RegExp(`function public\\.${fn}`));}
assert.match(sql,/enable row level security/);assert.match(sql,/has_permission\('hr\.approve'\)/);assert.match(sql,/payroll\.manage/);assert.match(sql,/net_salary numeric/);
for(const table of ["hr_leave_policies","hr_leave_balance_ledger"]){assert.match(policySql,new RegExp(`create table if not exists public\\.${table}\\b`));}
for(const fn of ["hr_refresh_leave_balances","hr_leave_balance_summary","hr_save_leave_policy"]){assert.match(policySql,new RegExp(`function public\\.${fn}`));}
assert.match(policySql,/\('Annual Leave',0\.5/);assert.match(policySql,/\('Casual Leave',0\.5/);assert.match(policySql,/\('Sick Leave',1/);
assert.match(policySql,/current_staff_role\(\)<>'HR_ADMIN'/);assert.match(policySql,/closing_balance/);assert.match(policySql,/PAID_LEAVE/);assert.match(policySql,/UNPAID_LEAVE/);
assert.match(allocationSql,/add column if not exists leave_allocations jsonb/);assert.match(allocationSql,/Mixed Leave/);assert.match(allocationSql,/allocation_total<>requested_days/);assert.match(allocationSql,/Combined leave balances can currently be used for one full day only/);
assert.match(payrollSql,/function public\.hr_generate_payroll/);assert.match(payrollSql,/Payroll is already generated for this month/);assert.match(payrollSql,/base_salary\*0\.11/);assert.match(payrollSql,/base_salary\*0\.01/);assert.match(payrollSql,/PAYROLL_GENERATED/);
for(const table of ["hr_attendance_corrections","hr_salary_components","hr_performance_targets"]){assert.match(operationsSql,new RegExp(`create table if not exists public\\.${table}\\b`));}
for(const fn of ["hr_update_employee","hr_change_employment_status","hr_save_shift","hr_assign_shift","hr_request_attendance_correction","hr_decide_attendance_correction","hr_save_salary_component","hr_update_payroll_item","hr_transition_payroll","hr_save_performance_target","hr_create_performance_review","hr_register_staff_document","hr_verify_staff_document"]){assert.match(operationsSql,new RegExp(`function public\\.${fn}`));}
for(const permission of ["attendance.manage","leave.approve","salary.manage","payroll.prepare","payroll.approve","payroll.pay","performance.manage","hr.documents.manage"]){assert.match(operationsSql,new RegExp(permission.replace(".","\\.")));}
assert.match(operationsSql,/submitted_by=auth\.uid\(\)/);assert.match(operationsSql,/must be approved by a different authorized user/);assert.match(operationsSql,/hr-staff-documents/);
assert.match(payrollNotificationsSql,/hr_salary_components/);assert.match(payrollNotificationsSql,/notify_hr_correction_request/);assert.match(payrollNotificationsSql,/notify_performance_target/);assert.match(payrollNotificationsSql,/notify_payroll_status/);assert.match(payrollNotificationsSql,/staff_has_permission/);
for(const feature of ["Today’s attendance","Pending leave requests","Upcoming probation end","Contract expiry watch","Quick actions"]){assert.match(hrmsUi,new RegExp(feature));}
assert.match(hrmsUi,/activeTab==="dashboard"/);assert.match(shellUi,/HR Dashboard/);assert.match(shellUi,/tab=dashboard/);
for(const field of ["date_of_birth","probation_end_date","manager_id","citizenship_number","payment_method"]){assert.match(employeeWorkspaceSql,new RegExp(field));}
assert.match(employeeWorkspaceSql,/hr_delete_salary_component/);assert.match(employeeWorkspaceSql,/hr_employee_activity/);assert.match(hrmsUi,/EmployeeProfileWorkspace/);assert.match(hrmsUi,/Deductions & statutory withholding/);assert.match(hrmsUi,/Edit every employee field/);
assert.match(payrollWorkspaceSql,/create table if not exists public\.hr_payroll_reminders/);assert.match(payrollWorkspaceSql,/hr_save_payroll_reminder/);assert.match(payrollWorkspaceSql,/hr_update_payroll_reminder/);
for(const feature of ["Payroll summary","Payroll handoff to Finance","Payment summary","Payslip preview","Salary & payroll reminders"]){assert.match(hrmsUi,new RegExp(feature));}
console.log("Phase 7 HRMS checks passed.");
