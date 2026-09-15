import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/202609100001_hrms_configuration_and_reports.sql");
const app=read("src/app/App.tsx");
const shell=read("src/components/layout/AppShell.tsx");
const settings=read("src/features/hrms/HrmsSettingsWorkspace.tsx");
const reports=read("src/features/hrms/HrmsReportsWorkspace.tsx");

for(const table of [
  "hr_departments","hr_designations","hr_employee_number_settings","hr_attendance_policies",
  "hr_salary_component_definitions","hr_payroll_policies","hr_tax_rule_sets","hr_tax_brackets",
  "hr_tds_ledger","hr_employment_history","hr_salary_history","hr_kpi_templates",
  "hr_appraisal_cycles","hr_document_types","hr_contracts","hr_approval_routes",
  "hr_approval_route_steps","hr_notification_rules","hr_report_catalog",
])assert.ok(migration.includes(`public.${table}`),`missing HRMS foundation table ${table}`);

for(const report of ["employee","attendance","leave","payroll","salary","performance","kpi","appraisal","workforce"]){
  assert.ok(migration.includes(`hr_report_${report}`),`missing ${report} report view`);
  assert.ok(reports.includes(`"${report}"`),`missing ${report} report UI mapping`);
}

assert.ok(migration.includes("hr_next_employee_code"),"configurable employee numbering is missing");
assert.ok(migration.includes("hr_capture_employee_history"),"employee history capture is missing");
assert.ok(migration.includes("hr_post_paid_payroll_tds"),"TDS ledger posting is missing");
assert.ok(migration.includes("'DRAFT','AECS payroll configuration brief - pending enacted-law verification'"),"unverified Nepal payroll values must remain draft");
assert.ok(app.includes('path="/hrms/settings"')&&app.includes('path="/hrms/reports"'),"HRMS configuration routes are missing");
assert.ok(shell.includes("HRMS Settings")&&shell.includes("HRMS Reports"),"HRMS navigation is missing");
assert.ok(settings.includes("Departments & designations")&&settings.includes("Approvals & notifications"),"recommended configuration order is incomplete");

console.log("Phase 13 HRMS configuration and report checks passed");
