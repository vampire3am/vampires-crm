export interface CoreReport {
  id: number;
  category: "Daily Management" | "HR and Staff" | "Leads and Counselling" | "Students and Applications" | "Documents and Visa" | "Booking and Academic" | "Finance and Accounting" | "Management and Audit";
  heading: string;
  primaryRoles: string[];
  description: string;
}

export const BLUEPRINT_50_REPORTS: CoreReport[] = [
  // 1. Daily Management
  { id: 1, category: "Daily Management", heading: "Daily Activity Summary", primaryRoles: ["Owner", "Director", "Operations Manager"], description: "Consolidated operational log of registrations, visits, and staff tasks completed today." },
  { id: 2, category: "Daily Management", heading: "Today's Appointments and Follow-ups", primaryRoles: ["Director", "Operations Manager", "Counsellor", "Follow-up Officer", "Front Desk"], description: "Time-slotted agenda of scheduled counselling sessions, walk-ins, and pending callback tasks." },
  { id: 3, category: "Daily Management", heading: "Pending and Overdue Tasks", primaryRoles: ["Director", "Operations Manager", "Assigned User"], description: "Exception list of operational tasks, SLA deadlines, and escalations requiring immediate action." },

  // 2. HR and Staff
  { id: 4, category: "HR and Staff", heading: "Employee Master Report", primaryRoles: ["Owner", "HR Administrator"], description: "Full roster of AECS staff members with designations, branches, departments, and employment status." },
  { id: 5, category: "HR and Staff", heading: "Employee Attendance Summary", primaryRoles: ["Owner", "Director", "HR Administrator", "Employee"], description: "Monthly attendance, late check-ins, leaves taken, and duty hours per team member." },
  { id: 6, category: "HR and Staff", heading: "Leave Request and Balance Report", primaryRoles: ["Owner", "HR Administrator", "Employee"], description: "Annual leave accrual, sick leave balance, and pending leave approvals." },
  { id: 7, category: "HR and Staff", heading: "Monthly Payroll Summary", primaryRoles: ["Owner", "HR Administrator", "Finance Officer"], description: "Consolidated gross salary, SSF/CIT deductions, TDS withholding, and net bank disbursement." },
  { id: 8, category: "HR and Staff", heading: "Employee Payslip Report", primaryRoles: ["Owner", "HR Administrator", "Finance Officer", "Employee"], description: "Individual confidential salary breakdown, allowances, and statutory contributions." },
  { id: 9, category: "HR and Staff", heading: "Staff Performance and KPI Report", primaryRoles: ["Owner", "Director", "HR Administrator", "Supervisor"], description: "Counselling conversion rate, enquiry resolution speed, and student satisfaction score." },
  { id: 10, category: "HR and Staff", heading: "Probation and Contract Expiry Report", primaryRoles: ["Owner", "Director", "HR Administrator"], description: "Early warning alerts for upcoming staff contract renewals and probation reviews." },

  // 3. Leads and Counselling
  { id: 11, category: "Leads and Counselling", heading: "Lead Master Report", primaryRoles: ["Director", "Operations Manager", "Counsellor", "Follow-up Officer"], description: "Master index of all prospective students with contact channels, interests, and assigned counsellor." },
  { id: 12, category: "Leads and Counselling", heading: "New and Assigned Leads Report", primaryRoles: ["Operations Manager", "Counsellor", "Follow-up Officer", "Front Desk"], description: "Breakdown of freshly captured website/walk-in leads awaiting initial consultation." },
  { id: 13, category: "Leads and Counselling", heading: "Follow-up Status Report", primaryRoles: ["Operations Manager", "Counsellor", "Follow-up Officer"], description: "Audit of follow-up attempts, contact outcomes (Connected, Busy, Call Back), and response sentiment." },
  { id: 14, category: "Leads and Counselling", heading: "Lead Conversion Funnel Report", primaryRoles: ["Owner", "Director", "Operations Manager", "Marketing Officer"], description: "Stage-by-stage progression from initial lead to registered student and visa candidate." },
  { id: 15, category: "Leads and Counselling", heading: "Lead Source and Campaign Report", primaryRoles: ["Owner", "Director", "Operations Manager", "Marketing Officer"], description: "Performance analysis across Meta Ads, Google Ads, Fairs, Seminars, and Organic Referrals." },
  { id: 16, category: "Leads and Counselling", heading: "Lost Lead Reason Report", primaryRoles: ["Director", "Operations Manager", "Counsellor", "Marketing Officer"], description: "Categorized analysis of disengaged leads (Budget, Rejection, Competitor, Plan Postponed)." },
  { id: 17, category: "Leads and Counselling", heading: "Counselling and Office Visit Report", primaryRoles: ["Director", "Operations Manager", "Counsellor", "Front Desk"], description: "In-person Kathmandu office visits, desk counselling sessions, and physical intake registers." },

  // 4. Students and Applications
  { id: 18, category: "Students and Applications", heading: "Student Master Report", primaryRoles: ["Director", "Operations Manager", "Counsellor", "Application Officer", "Documentation Officer"], description: "Comprehensive directory of registered students with student code, DOB, address, and status." },
  { id: 19, category: "Students and Applications", heading: "Student Status Summary", primaryRoles: ["Director", "Operations Manager", "Counsellor", "Application Officer"], description: "High-level grouping by stage: New Lead, Counselling, Applied, Offer Received, Visa Lodged, Enrolled." },
  { id: 20, category: "Students and Applications", heading: "Student Document Status Report", primaryRoles: ["Operations Manager", "Application Officer", "Documentation Officer", "Visa Officer"], description: "Document completeness matrix tracking verified vs missing transcripts, tests, and passports." },
  { id: 21, category: "Students and Applications", heading: "Application Master Report", primaryRoles: ["Director", "Operations Manager", "Application Officer"], description: "Complete registry of university applications submitted, target courses, and universities." },
  { id: 22, category: "Students and Applications", heading: "Pending and Submitted Applications Report", primaryRoles: ["Director", "Operations Manager", "Application Officer"], description: "Tracking university response times, agent portal status, and pending application fees." },
  { id: 23, category: "Students and Applications", heading: "Application Deadline Report", primaryRoles: ["Operations Manager", "Application Officer", "Counsellor"], description: "Upcoming university intake application deadlines and CAS/I-20 issuance cutoffs." },
  { id: 24, category: "Students and Applications", heading: "Offer Letter Status Report", primaryRoles: ["Director", "Operations Manager", "Counsellor", "Application Officer"], description: "Tracking conditional and unconditional offer letters, deposit deadlines, and acceptance status." },
  { id: 25, category: "Students and Applications", heading: "Application Conversion & Officer Performance Report", primaryRoles: ["Owner", "Director", "Operations Manager"], description: "Offers generated and conversion rates attributed to each application team member." },

  // 5. Documents and Visa
  { id: 26, category: "Documents and Visa", heading: "Missing Documents Report", primaryRoles: ["Operations Manager", "Application Officer", "Documentation Officer", "Visa Officer"], description: "Actionable list of overdue documents required from students before submission." },
  { id: 27, category: "Documents and Visa", heading: "Document Verification Report", primaryRoles: ["Operations Manager", "Documentation Officer", "Visa Officer"], description: "Audit trail of document review approvals, notary checks, and rejection remarks." },
  { id: 28, category: "Documents and Visa", heading: "Student File Status Report", primaryRoles: ["Director", "Operations Manager", "Documentation Officer", "Visa Officer"], description: "Readiness score of student case files prior to formal embassy visa submission." },
  { id: 29, category: "Documents and Visa", heading: "Visa Processing Pipeline Report", primaryRoles: ["Owner", "Director", "Operations Manager", "Visa Officer"], description: "Active visa lodgements across UK, Australia, Canada, USA, and Schengen embassies." },
  { id: 30, category: "Documents and Visa", heading: "Biometrics and Medical Status Report", primaryRoles: ["Director", "Operations Manager", "Visa Officer"], description: "Appointment scheduling, VFS biometrics completion, and medical panel clearances." },
  { id: 31, category: "Documents and Visa", heading: "Visa Decision, Approval and Refusal Analysis", primaryRoles: ["Owner", "Director", "Operations Manager", "Visa Officer"], description: "Approval rates by destination country, institution tier, and refusal root cause analysis." },

  // 6. Booking and Academic
  { id: 32, category: "Booking and Academic", heading: "Test Booking Report", primaryRoles: ["Operations Manager", "Test Booking Officer", "Finance Officer"], description: "Exam seat bookings for IELTS (IDP/BC), PTE Academic, and Duolingo with dates and venues." },
  { id: 33, category: "Booking and Academic", heading: "Booking Payment and Revenue Report", primaryRoles: ["Owner", "Director", "Finance Officer", "Test Booking Officer"], description: "Exam fee collections, service fee margins, and provider settlement balances." },
  { id: 34, category: "Booking and Academic", heading: "Class and Batch Report", primaryRoles: ["Director", "Operations Manager", "Academic Coordinator", "Teacher"], description: "Active IELTS, PTE, and German language batches, assigned classrooms, and student capacity." },
  { id: 35, category: "Booking and Academic", heading: "Student Attendance Report", primaryRoles: ["Academic Coordinator", "Teacher", "Student"], description: "Classroom and online mock test attendance logs per student." },
  { id: 36, category: "Booking and Academic", heading: "Teacher Performance and Student Progress Report", primaryRoles: ["Owner", "Director", "Operations Manager", "Academic Coordinator", "Teacher"], description: "Pre-test vs final test score improvements and teacher review feedback." },

  // 7. Finance and Accounting
  { id: 37, category: "Finance and Accounting", heading: "Invoice and Payment Request Report", primaryRoles: ["Owner", "Finance Officer", "Authorized Operations User"], description: "Customer billing records, service item breakdown, tax category, and payment status." },
  { id: 38, category: "Finance and Accounting", heading: "Receipt and Collection Report", primaryRoles: ["Owner", "Director", "Finance Officer"], description: "Collections realized via cash counter, bank transfers, eSewa, Khalti, and card swipe." },
  { id: 39, category: "Finance and Accounting", heading: "Accounts Receivable & Outstanding Balance Report", primaryRoles: ["Owner", "Director", "Finance Officer", "Counsellor"], description: "Aged receivables from students and university commission invoices overdue." },
  { id: 40, category: "Finance and Accounting", heading: "Accounts Payable & Partner Payables Report", primaryRoles: ["Owner", "Director", "Finance Officer"], description: "Outstanding liabilities to test booking partners, sub-agents, and vendors." },
  { id: 41, category: "Finance and Accounting", heading: "Daily Cash and Bank Summary", primaryRoles: ["Owner", "Finance Officer"], description: "Opening balance, daily receipts, payments, and reconciled closing balances in Kathmandu." },
  { id: 42, category: "Finance and Accounting", heading: "General Ledger", primaryRoles: ["Owner", "Finance Officer", "Auditor"], description: "Complete detailed transaction history mapped to Chart of Accounts posting codes." },
  { id: 43, category: "Finance and Accounting", heading: "Trial Balance", primaryRoles: ["Owner", "Finance Officer", "Auditor"], description: "Debit and credit balance verification for all ledger accounts at period closing." },
  { id: 44, category: "Finance and Accounting", heading: "Profit and Loss Statement", primaryRoles: ["Owner", "Director", "Finance Officer", "Auditor"], description: "Revenue from consultancy, commissions, and classes less direct costs and operating expenses." },
  { id: 45, category: "Finance and Accounting", heading: "Balance Sheet", primaryRoles: ["Owner", "Director", "Finance Officer", "Auditor"], description: "Assets, liabilities, and owners' equity statement in compliance with Nepal accounting standards." },
  { id: 46, category: "Finance and Accounting", heading: "Cash Flow Statement", primaryRoles: ["Owner", "Director", "Finance Officer", "Auditor"], description: "Cash inflows and outflows from operating, investing, and financing activities." },
  { id: 47, category: "Finance and Accounting", heading: "VAT, Tax and TDS Report", primaryRoles: ["Owner", "HR Administrator", "Finance Officer", "Auditor"], description: "Withholding tax deducted on rent, salary, and service fees ready for IRD Nepal filing." },
  { id: 48, category: "Finance and Accounting", heading: "Expense and Refund Report", primaryRoles: ["Owner", "Director", "Finance Officer"], description: "Operating expenditures against budget and processed student refund payments." },

  // 8. Management and Audit
  { id: 49, category: "Management and Audit", heading: "Management Dashboard Summary", primaryRoles: ["Owner", "Director", "Authorized Managers"], description: "Executive KPI snapshot summarizing revenue, enrolments, active pipeline, and staff load." },
  { id: 50, category: "Management and Audit", heading: "User Activity and Audit Log", primaryRoles: ["Super Administrator", "Owner", "Auditor"], description: "Immutable security trail of staff logins, record modifications, permissions changes, and exports." },
];
