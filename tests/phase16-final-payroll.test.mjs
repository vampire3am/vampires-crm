import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/202609170001_aecs_final_payroll.sql", import.meta.url), "utf8");
const automatedMigration = readFileSync(new URL("../supabase/migrations/202610130001_automated_bs_payroll_calendar.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/services/hrmsService.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/features/hrms/HrmsWorkspace.tsx", import.meta.url), "utf8");
const nepaliDate = readFileSync(new URL("../src/lib/nepaliDate.ts", import.meta.url), "utf8");

for (const contract of [
  "hr_bs_calendar", "hr_attendance_periods", "hr_payroll_profiles", "hr_payroll_settings",
  "hr_payroll_approval_log", "hr_payroll_payments", "hr_payroll_adjustments",
  "hr_close_attendance_period", "hr_generate_bs_payroll", "hr_transition_bs_payroll",
  "attendance.close_month", "payroll.prepare", "payroll.review", "payroll.approve",
  "payroll.finalize", "payroll.reverse", "payroll.pay", "payroll.sensitive.view",
]) assert.ok(migration.includes(contract), `missing final payroll contract: ${contract}`);

assert.match(migration, /ssf_status[^;]+default 'NOT_APPLICABLE'/s);
assert.match(migration, /cit_status[^;]+default 'NOT_APPLICABLE'/s);
assert.match(migration, /Finalized payroll is immutable/);
assert.match(migration, /Maker-checker control/);
for (const contract of [
  "hr_attendance_exceptions", "hr_run_automated_bs_payroll", "hr_monthly_tds_from_approved_rules",
  "hr_payroll_finalization_guard", "ACTUAL_BS_CALENDAR_DAYS", "MISSING_PUNCH_OUT", "unpaid_units", "salary_basis",
]) assert.ok(automatedMigration.includes(contract), `missing automated payroll contract: ${contract}`);
assert.match(automatedMigration, /calendar_day_count not between 29 and 32/);
assert.match(automatedMigration, /base_entitlement-attendance_deduction_value/);
assert.match(automatedMigration, /status='ACTIVE' and approved_at is not null/);
assert.match(automatedMigration, /Payroll already exists for this BS month/);
assert.match(service, /hr_run_automated_bs_payroll/);
assert.match(service, /hr_transition_bs_payroll/);
assert.match(nepaliDate, /getBsMonthCalendar/);
assert.match(nepaliDate, /bsFiscalYear/);
assert.doesNotMatch(workspace, /SSF 11%|Citizen Investment \(CIT\)|CIT & TDS/);
assert.doesNotMatch(workspace, /TDS \(1%|1% TDS/);
assert.match(workspace, /Paid calendar days/);
assert.match(workspace, /Nepali calendar/);

console.log("Phase 16 final AECS payroll contract tests passed");
