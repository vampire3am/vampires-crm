import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/202609170001_aecs_final_payroll.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/services/hrmsService.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/features/hrms/HrmsWorkspace.tsx", import.meta.url), "utf8");

for (const contract of [
  "hr_bs_calendar", "hr_attendance_periods", "hr_payroll_profiles", "hr_payroll_settings",
  "hr_payroll_approval_log", "hr_payroll_payments", "hr_payroll_adjustments",
  "hr_close_attendance_period", "hr_generate_bs_payroll", "hr_transition_bs_payroll",
  "attendance.close_month", "payroll.prepare", "payroll.review", "payroll.approve",
  "payroll.finalize", "payroll.reverse", "payroll.pay", "payroll.sensitive.view",
]) assert.ok(migration.includes(contract), `missing final payroll contract: ${contract}`);

assert.match(migration, /tds_rate[^;]+default \.01/s);
assert.match(migration, /ssf_status[^;]+default 'NOT_APPLICABLE'/s);
assert.match(migration, /cit_status[^;]+default 'NOT_APPLICABLE'/s);
assert.match(migration, /emp\.base_salary\*\(least\(payable,scheduled\)\/scheduled\)/);
assert.match(migration, /Finalized payroll is immutable/);
assert.match(migration, /Maker-checker control/);
assert.match(service, /hr_close_attendance_period/);
assert.match(service, /hr_generate_bs_payroll/);
assert.match(service, /hr_transition_bs_payroll/);
assert.doesNotMatch(workspace, /SSF 11%|Citizen Investment \(CIT\)|CIT & TDS/);
assert.match(workspace, /Income Tax TDS \(1% of gross\)/);
assert.match(workspace, /Payable days/);

console.log("Phase 16 final AECS payroll contract tests passed");
