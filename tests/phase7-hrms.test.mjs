import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql=readFileSync("supabase/migrations/202608210017_phase7_hrms.sql","utf8");
for(const table of ["hr_employees","hr_shifts","hr_shift_assignments","hr_attendance","hr_leave_requests","hr_payroll_runs","hr_payroll_items","hr_performance_reviews","hr_staff_documents"]){assert.match(sql,new RegExp(`create table public\\.${table}\\b`));}
for(const fn of ["hr_create_employee","hr_clock_in","hr_request_leave","hr_decide_leave"]){assert.match(sql,new RegExp(`function public\\.${fn}`));}
assert.match(sql,/enable row level security/);assert.match(sql,/has_permission\('hr\.approve'\)/);assert.match(sql,/payroll\.manage/);assert.match(sql,/net_salary numeric/);
console.log("Phase 7 HRMS checks passed.");
