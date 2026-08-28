import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync("supabase/migrations/202608210017_phase7_hrms.sql","utf8");
const policySql=readFileSync("supabase/migrations/202608280003_hrms_leave_policy_engine.sql","utf8");
for(const table of ["hr_employees","hr_shifts","hr_shift_assignments","hr_attendance","hr_leave_requests","hr_payroll_runs","hr_payroll_items","hr_performance_reviews","hr_staff_documents"]){assert.match(sql,new RegExp(`create table public\\.${table}\\b`));}
for(const fn of ["hr_create_employee","hr_clock_in","hr_request_leave","hr_decide_leave"]){assert.match(sql,new RegExp(`function public\\.${fn}`));}
assert.match(sql,/enable row level security/);assert.match(sql,/has_permission\('hr\.approve'\)/);assert.match(sql,/payroll\.manage/);assert.match(sql,/net_salary numeric/);
for(const table of ["hr_leave_policies","hr_leave_balance_ledger"]){assert.match(policySql,new RegExp(`create table if not exists public\\.${table}\\b`));}
for(const fn of ["hr_refresh_leave_balances","hr_leave_balance_summary","hr_save_leave_policy"]){assert.match(policySql,new RegExp(`function public\\.${fn}`));}
assert.match(policySql,/\('Annual Leave',0\.5/);assert.match(policySql,/\('Casual Leave',0\.5/);assert.match(policySql,/\('Sick Leave',1/);
assert.match(policySql,/current_staff_role\(\)<>'HR_ADMIN'/);assert.match(policySql,/closing_balance/);assert.match(policySql,/PAID_LEAVE/);assert.match(policySql,/UNPAID_LEAVE/);
console.log("Phase 7 HRMS checks passed.");
