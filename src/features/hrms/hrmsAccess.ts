export type HrmsTab = "dashboard" | "staff" | "attendance" | "leaves" | "payroll" | "performance" | "documents";

export const HRMS_TAB_PERMISSIONS: Record<HrmsTab, string[]> = {
  dashboard: ["hr.view", "hr.manage"],
  staff: ["hr.view", "hr.manage"],
  attendance: ["hr.self_service", "attendance.view", "attendance.correct", "attendance.manage"],
  leaves: ["hr.self_service", "hr.approve", "leave.approve"],
  payroll: ["payroll.view", "payroll.manage", "payroll.prepare", "payroll.approve", "payroll.pay", "salary.view", "salary.manage"],
  performance: ["performance.view", "performance.manage"],
  documents: ["hr.documents.manage"],
};

export const HRMS_TAB_ORDER: HrmsTab[] = ["dashboard", "staff", "attendance", "leaves", "payroll", "performance", "documents"];

export function canAccessHrmsTab(tab: HrmsTab, hasPermission: (permission: string) => boolean) {
  return HRMS_TAB_PERMISSIONS[tab].some(hasPermission);
}
