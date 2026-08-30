export type PermissionItem = { key: string; label: string; description?: string };
export type PermissionGroup = { id: string; label: string; module: string; permissions: PermissionItem[] };

export const STAFF_PERMISSION_GROUPS: PermissionGroup[] = [
  { id: "dashboard", label: "Dashboard & alerts", module: "dashboard", permissions: [
    { key: "dashboard.view", label: "View dashboard" },
    { key: "notifications.view", label: "View personal notifications" },
  ]},
  { id: "administration", label: "Administration", module: "settings", permissions: [
    { key: "admin.manage", label: "Manage global CRM settings" },
    { key: "rbac.manage", label: "Manage users, roles and permissions" },
    { key: "branches.manage", label: "Manage branches" },
    { key: "audit.view", label: "View audit logs" },
  ]},
  { id: "leads", label: "Leads & follow-ups", module: "leads", permissions: [
    { key: "leads.view", label: "View leads" }, { key: "leads.create", label: "Create leads" },
    { key: "leads.edit", label: "Edit, assign, convert and follow up leads" },
    { key: "leads.delete", label: "Delete leads" },
  ]},
  { id: "students", label: "Students", module: "students", permissions: [
    { key: "students.view", label: "View student profiles" }, { key: "students.create", label: "Create students" },
    { key: "students.edit", label: "Edit student profiles" }, { key: "students.delete", label: "Delete students" },
  ]},
  { id: "applications", label: "Applications & tasks", module: "applications", permissions: [
    { key: "applications.view", label: "View applications" }, { key: "applications.edit", label: "Create, edit and move applications" },
    { key: "applications.manage", label: "Manage application operations" },
    { key: "case_tasks.view", label: "View case tasks" }, { key: "case_tasks.edit", label: "Create and manage case tasks" },
  ]},
  { id: "abroad", label: "Abroad & counselling", module: "counselling", permissions: [
    { key: "counselling.view", label: "View destinations and consultation records" },
    { key: "counselling.edit", label: "Manage destinations, universities and consultations" },
    { key: "counselling.manage", label: "Administer counselling workspace" },
  ]},
  { id: "documents", label: "Document vault", module: "documents", permissions: [
    { key: "documents.view", label: "View authorized documents" }, { key: "documents.upload", label: "Upload documents" },
    { key: "documents.verify", label: "Verify or reject documents" }, { key: "documents.manage", label: "Manage document records" },
    { key: "documents.delete", label: "Delete documents" },
  ]},
  { id: "b2b", label: "B2B partners", module: "b2b", permissions: [
    { key: "b2b.view", label: "View partner directory and agreements" },
    { key: "b2b.create", label: "Create B2B partner profiles" },
    { key: "b2b.edit", label: "Edit partners and record follow-ups" },
    { key: "b2b.delete", label: "Remove B2B partners" },
  ]},
  { id: "classes", label: "Classes & attendance", module: "classes", permissions: [
    { key: "classes.view", label: "View classes, batches and students" },
    { key: "classes.manage", label: "Create and manage class records" },
    { key: "attendance.manage", label: "Record and correct class attendance" },
  ]},
  { id: "mocks", label: "Mock tests", module: "mocks", permissions: [
    { key: "mocks.manage", label: "Manage slots, candidates and mock results" },
  ]},
  { id: "finance", label: "Finance & accounting", module: "finance", permissions: [
    { key: "finance.view", label: "View finance and accounting records" },
    { key: "finance.create", label: "Create invoices, receipts and commissions" },
    { key: "finance.approve", label: "Approve financial transactions" },
  ]},
  { id: "hr", label: "HRMS & employees", module: "hrms", permissions: [
    { key: "hr.self_service", label: "Use personal attendance and leave" }, { key: "hr.view", label: "View HR workspace" },
    { key: "hr.manage", label: "Manage employee profiles, lifecycle and shifts" },
    { key: "attendance.view", label: "View attendance registers" },
    { key: "attendance.correct", label: "Request attendance corrections" },
    { key: "attendance.manage", label: "Approve corrections and manage attendance" },
    { key: "hr.approve", label: "Approve or reject leave requests" },
    { key: "leave.approve", label: "Give final HR leave approval" },
    { key: "performance.view", label: "View authorized performance records" },
    { key: "performance.manage", label: "Assign targets and record reviews" },
    { key: "hr.documents.manage", label: "Manage confidential employee documents" },
  ]},
  { id: "payroll", label: "Payroll", module: "hrms", permissions: [
    { key: "payroll.view", label: "View payroll register and payslips" },
    { key: "payroll.manage", label: "Generate and manage monthly payroll" },
    { key: "salary.view", label: "View confidential employee salary details" },
    { key: "salary.manage", label: "Manage salary components and deductions" },
    { key: "payroll.prepare", label: "Prepare and submit monthly payroll" },
    { key: "payroll.approve", label: "Approve submitted payroll" },
    { key: "payroll.pay", label: "Record approved payroll as paid" },
  ]},
  { id: "communications", label: "Messages & email", module: "messages", permissions: [
    { key: "communications.use", label: "Use private and team messaging" },
    { key: "communications.manage", label: "Manage communication channels" },
    { key: "email.send", label: "Send operational email" }, { key: "email.manage", label: "Manage email templates and automation" },
  ]},
  { id: "reports", label: "Reports", module: "reports", permissions: [
    { key: "reports.view", label: "View reports" }, { key: "reports.export", label: "Export reports" },
  ]},
  { id: "operations", label: "System operations", module: "settings", permissions: [
    { key: "monitoring.view", label: "View system monitoring" }, { key: "monitoring.manage", label: "Manage system monitoring" },
    { key: "backups.verify", label: "Verify backups" },
  ]},
];

export const STAFF_PERMISSION_KEYS = STAFF_PERMISSION_GROUPS.flatMap(group => group.permissions.map(permission => permission.key));

export function modulesForPermissions(permissionKeys: string[]) {
  const enabled = new Set(permissionKeys);
  return [...new Set(STAFF_PERMISSION_GROUPS.filter(group => group.permissions.some(item => enabled.has(item.key))).map(group => group.module))];
}
