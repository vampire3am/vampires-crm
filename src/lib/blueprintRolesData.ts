export interface CrmRole {
  name: string;
  code: string;
  coreAccess: string;
  defaultScope: "Organization-wide" | "Assigned branch" | "Assigned records" | "Department records" | "Own records only" | "Explicitly approved scope";
  keyRestriction: string;
}

export const BLUEPRINT_ROLES: CrmRole[] = [
  { name: "Super Administrator", code: "SUPER_ADMIN", coreAccess: "System setup, integrations, users, roles, security, backups and audit.", defaultScope: "Organization-wide", keyRestriction: "No automatic payroll or confidential HR access." },
  { name: "Owner / Managing Director", code: "OWNER_MD", coreAccess: "Management dashboards, finance summaries, staff performance, applications, visa results and approvals.", defaultScope: "Organization-wide", keyRestriction: "Sensitive approvals enabled according to policy." },
  { name: "Director / Executive Supervisor", code: "DIRECTOR", coreAccess: "Operations, staff performance, leads, applications, visa and academic oversight.", defaultScope: "Organization-wide", keyRestriction: "Detailed payroll and employee bank data restricted by default." },
  { name: "HR Administrator", code: "HR_ADMIN", coreAccess: "Employees, contracts, attendance, leave, payroll, performance, recruitment and exits.", defaultScope: "Organization-wide", keyRestriction: "No operational case editing unless separately assigned." },
  { name: "Operations Manager", code: "OPERATIONS_MANAGER", coreAccess: "Tasks, workloads, leads, applications, documents, bookings, classes and escalations.", defaultScope: "Department records", keyRestriction: "No attendance, leave, payroll, TDS or confidential HR access by default." },
  { name: "Branch Manager", code: "BRANCH_MANAGER", coreAccess: "Branch employees, leads, students, applications, classes and branch performance.", defaultScope: "Assigned branch", keyRestriction: "Cannot view other branches unless approved." },
  { name: "Finance & Accounts Officer", code: "FINANCE_OFFICER", coreAccess: "Invoices, receipts, payments, refunds processing, expenses, payroll processing and accounting reports.", defaultScope: "Assigned branch", keyRestriction: "Refund approval and salary changes require separate authority." },
  { name: "Counsellor", code: "COUNSELLOR", coreAccess: "Assigned leads, eligibility, counselling, follow-ups, visits and application initiation.", defaultScope: "Assigned records", keyRestriction: "No unrelated student, payroll or visa records." },
  { name: "Lead & Follow-up Officer", code: "LEAD_OFFICER", coreAccess: "Assigned leads, calls, messages, follow-ups, status updates and appointments.", defaultScope: "Assigned records", keyRestriction: "No financial or confidential records." },
  { name: "Front Desk & Data Officer", code: "FRONT_DESK", coreAccess: "Inquiries, walk-ins, appointments, lead creation, basic student registration and data quality.", defaultScope: "Assigned branch", keyRestriction: "No visa, payroll or confidential finance access." },
  { name: "Application Officer", code: "APPLICATION_OFFICER", coreAccess: "Assigned applications, submissions, offers, deadlines and status updates.", defaultScope: "Assigned records", keyRestriction: "No visa lodgement or refund approval." },
  { name: "Documentation Officer", code: "DOCUMENTATION_OFFICER", coreAccess: "Document collection, verification, missing documents, file completion and deadlines.", defaultScope: "Assigned records", keyRestriction: "No visa lodgement unless separately permitted." },
  { name: "Visa Officer", code: "VISA_OFFICER", coreAccess: "Visa checklist, file preparation, biometrics, medical, lodgement processing and decisions.", defaultScope: "Assigned records", keyRestriction: "Final lodgement approval remains separate." },
  { name: "Test Booking Officer", code: "TEST_BOOKING_OFFICER", coreAccess: "Test bookings, payments, rescheduling, cancellation and booking reports.", defaultScope: "Assigned records", keyRestriction: "Refund approval remains with finance/management." },
  { name: "Teacher / Trainer", code: "TEACHER", coreAccess: "Own batches, attendance, assessments, mock tests, progress and feedback.", defaultScope: "Assigned records", keyRestriction: "No unrelated student applications or staff records." },
  { name: "Academic Coordinator", code: "ACADEMIC_COORDINATOR", coreAccess: "Teacher schedules, batch allocation, workload, attendance, course completion and academic reports.", defaultScope: "Department records", keyRestriction: "No payroll or visa access unless separately assigned." },
  { name: "Marketing Officer", code: "MARKETING_OFFICER", coreAccess: "Campaigns, lead sources, ad results, content schedules and marketing reports.", defaultScope: "Organization-wide", keyRestriction: "No student visa, payroll or payment details." },
  { name: "Auditor / Read-Only User", code: "AUDITOR", coreAccess: "Approved reports, financial summaries, audit and compliance records.", defaultScope: "Explicitly approved scope", keyRestriction: "No create, edit, delete or approve permissions." },
];

export const SENSITIVE_PERMISSIONS = [
  { id: "view_payroll", name: "View payroll and salary details", risk: "High", requiresSegregation: true },
  { id: "approve_payroll", name: "Approve payroll batches", risk: "Critical", requiresSegregation: true },
  { id: "approve_leave", name: "Approve staff leave requests", risk: "Medium", requiresSegregation: false },
  { id: "edit_salary", name: "Edit salary structure and allowances", risk: "Critical", requiresSegregation: true },
  { id: "view_confidential_hr", name: "View confidential employee documents", risk: "High", requiresSegregation: false },
  { id: "approve_refunds", name: "Approve student fee refunds or credit notes", risk: "Critical", requiresSegregation: true },
  { id: "delete_records", name: "Delete or restore soft-deleted records", risk: "Critical", requiresSegregation: true },
  { id: "export_personal_data", name: "Export student or employee personal data", risk: "Critical", requiresSegregation: true },
  { id: "view_full_visa_docs", name: "View full visa and financial confidential files", risk: "High", requiresSegregation: false },
  { id: "approve_visa_lodgement", name: "Approve official embassy visa lodgement", risk: "Critical", requiresSegregation: true },
  { id: "modify_posted_ledger", name: "Modify posted payments or accounting entries", risk: "Critical", requiresSegregation: true },
  { id: "manage_roles", name: "Manage users, roles and permissions", risk: "Critical", requiresSegregation: true },
  { id: "view_audit_logs", name: "View immutable system audit logs", risk: "Medium", requiresSegregation: false },
  { id: "override_branch_scope", name: "Override branch or assigned-record restrictions", risk: "Critical", requiresSegregation: true },
];

export const MAKER_CHECKER_RULES = [
  { action: "Student Refund Disbursement", rule: "The officer requesting a refund cannot be the final approver." },
  { action: "Visa Lodgement Submission", rule: "Documentation Officer compiles file; Senior Visa Officer / Director approves lodgement." },
  { action: "Payroll Execution", rule: "HR Administrator prepares monthly batch; Finance Director / MD confirms bank payout." },
  { action: "Account Role Escalation", rule: "Admin creates user; Owner / Super Admin must authorize privileged role assignment." },
  { action: "Chart of Accounts Ledger Posting", rule: "Transactions post to detail accounts; posting to suspense/opening balance requires finance manager override." },
];
