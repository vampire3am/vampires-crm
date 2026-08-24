export interface AccountItem {
  code: string;
  name: string;
  level: number;
  parentCode?: string;
  type: "Asset" | "Liability" | "Equity" | "Income" | "Expense" | "Control";
  classification: string;
  normalBalance: "Debit" | "Credit";
  isPosting: boolean;
  status: "Active" | "Deactivated" | "Pending";
  description: string;
}

export const AECS_ACCOUNT_CATEGORIES = [
  { code: "1000", name: "1000 - ASSETS", count: 86, type: "Asset" },
  { code: "2000", name: "2000 - LIABILITIES", count: 72, type: "Liability" },
  { code: "3000", name: "3000 - EQUITY", count: 12, type: "Equity" },
  { code: "4000", name: "4000 - OPERATING INCOME", count: 64, type: "Income" },
  { code: "5000", name: "5000 - DIRECT COSTS / COST OF SERVICES", count: 48, type: "Expense" },
  { code: "6000", name: "6000 - OPERATING EXPENSES", count: 119, type: "Expense" },
  { code: "7000", name: "7000 - OTHER INCOME & EXPENSE", count: 23, type: "Income" },
  { code: "8000", name: "8000 - CONTROL & TAX ACCOUNTS", count: 30, type: "Control" },
] as const;

export const AECS_CHART_OF_ACCOUNTS: AccountItem[] = [
  // 1000 Assets
  { code: "1000", name: "Assets", level: 1, type: "Asset", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "All economic resources controlled by the company." },
  { code: "1100", name: "Current Assets", level: 2, parentCode: "1000", type: "Asset", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Assets expected to be realized within twelve months." },
  { code: "1110", name: "Cash and Cash Equivalents", level: 3, parentCode: "1100", type: "Asset", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Cash, petty cash and undeposited collections." },
  { code: "1111", name: "Cash in Hand", level: 4, parentCode: "1110", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Cash maintained at the main office in Kathmandu." },
  { code: "1112", name: "Petty Cash", level: 4, parentCode: "1110", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Small day-to-day office cash fund for incidental expenses." },
  { code: "1113", name: "Cash at Learning Center", level: 4, parentCode: "1110", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Cash maintained at the training/learning test center." },
  { code: "1114", name: "Undeposited Funds", level: 4, parentCode: "1110", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Collections received but not yet deposited in bank accounts." },
  { code: "1120", name: "Bank and Digital Wallet Accounts", level: 3, parentCode: "1100", type: "Asset", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Separate ledger for each bank account and digital wallet." },
  { code: "1121", name: "Bank Current Account – Primary", level: 4, parentCode: "1120", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Primary operating commercial bank account in Nepal." },
  { code: "1122", name: "Bank Current Account – Secondary", level: 4, parentCode: "1120", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Secondary operating bank account." },
  { code: "1123", name: "Bank Savings Account", level: 4, parentCode: "1120", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Savings or reserve bank account for liquidity buffer." },
  { code: "1124", name: "Fixed Deposit – Short Term", level: 4, parentCode: "1120", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Short-term fixed deposit maturing within twelve months." },
  { code: "1125", name: "eSewa Account", level: 4, parentCode: "1120", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Business eSewa digital wallet balance for student fees." },
  { code: "1126", name: "Khalti Account", level: 4, parentCode: "1120", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Business Khalti digital wallet balance." },
  { code: "1127", name: "Payment Gateway Clearing Account", level: 4, parentCode: "1120", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Temporary clearing account for online student card/QR collections." },
  { code: "1130", name: "Accounts Receivable", level: 3, parentCode: "1100", type: "Asset", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Amounts receivable from students, institutions and partners." },
  { code: "1131", name: "Student Service Fee Receivable", level: 4, parentCode: "1130", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Consultancy or service fees due from registered students." },
  { code: "1132", name: "Class Fee Receivable", level: 4, parentCode: "1130", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Test preparation (IELTS/PTE) and language class fees due." },
  { code: "1133", name: "Test Booking Receivable", level: 4, parentCode: "1130", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Amounts due for test booking services handled for students." },
  { code: "1134", name: "University Commission Receivable", level: 4, parentCode: "1130", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Commission earned but not yet received from overseas universities." },
  { code: "1135", name: "Partner Commission Receivable", level: 4, parentCode: "1130", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Commission due from institutional or B2B aggregator partners." },
  { code: "1136", name: "B2B Agent Receivable", level: 4, parentCode: "1130", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Amounts due from sub-agents or regional business partners." },
  { code: "1139", name: "Allowance for Doubtful Receivables", level: 4, parentCode: "1130", type: "Asset", classification: "Contra asset", normalBalance: "Credit", isPosting: true, status: "Active", description: "Contra-asset allowance for estimated uncollectible receivables." },
  { code: "1140", name: "Advances and Deposits", level: 3, parentCode: "1100", type: "Asset", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Recoverable advances and refundable deposits." },
  { code: "1141", name: "Employee Advance", level: 4, parentCode: "1140", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Short-term operational advances given to employees." },
  { code: "1142", name: "Salary Advance", level: 4, parentCode: "1140", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Salary paid in advance and recoverable from next payroll cycle." },
  { code: "1147", name: "Office Rent Deposit", level: 4, parentCode: "1140", type: "Asset", classification: "Current asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Refundable office lease security deposit." },
  { code: "1200", name: "Non-Current Assets", level: 2, parentCode: "1000", type: "Asset", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Long-term assets held for business use or investment." },
  { code: "1210", name: "Property, Plant and Equipment", level: 3, parentCode: "1200", type: "Asset", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Tangible fixed assets used by AECS consultancy." },
  { code: "1213", name: "Leasehold Improvements", level: 4, parentCode: "1210", type: "Asset", classification: "Fixed asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Capital improvements made to rented office and learning premises." },
  { code: "1214", name: "Furniture and Fixtures", level: 4, parentCode: "1210", type: "Asset", classification: "Fixed asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Desks, chairs, counselling cubicles and cabinets." },
  { code: "1216", name: "Desktop & Laptop Computers", level: 4, parentCode: "1210", type: "Asset", classification: "Fixed asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Counselling and lab computer workstations." },
  { code: "1240", name: "Intangible Assets", level: 3, parentCode: "1200", type: "Asset", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Identifiable non-physical software and IP assets." },
  { code: "1241", name: "CRM Software System", level: 4, parentCode: "1240", type: "Asset", classification: "Intangible asset", normalBalance: "Debit", isPosting: true, status: "Active", description: "Capitalized AECS Student Management & CRM System." },

  // 2000 Liabilities
  { code: "2000", name: "Liabilities", level: 1, type: "Liability", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Present obligations of the company." },
  { code: "2100", name: "Current Liabilities", level: 2, parentCode: "2000", type: "Liability", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Obligations expected to be settled within twelve months." },
  { code: "2110", name: "Accounts Payable", level: 3, parentCode: "2100", type: "Liability", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Amounts due to suppliers and service providers." },
  { code: "2111", name: "Vendor Payable", level: 4, parentCode: "2110", type: "Liability", classification: "Current liability", normalBalance: "Credit", isPosting: true, status: "Active", description: "General supplier and service-provider balances." },
  { code: "2114", name: "Test Booking Partner Payable", level: 4, parentCode: "2110", type: "Liability", classification: "Current liability", normalBalance: "Credit", isPosting: true, status: "Active", description: "Amounts payable to test providers (IDP, British Council, Pearson)." },
  { code: "2120", name: "Student and Client Payables", level: 3, parentCode: "2100", type: "Liability", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Amounts collected or refundable to students and clients." },
  { code: "2121", name: "Student Refund Payable", level: 4, parentCode: "2120", type: "Liability", classification: "Current liability", normalBalance: "Credit", isPosting: true, status: "Active", description: "Approved refunds owed to students awaiting disbursement." },
  { code: "2126", name: "Student Funds Held in Trust", level: 4, parentCode: "2120", type: "Liability", classification: "Current liability", normalBalance: "Credit", isPosting: true, status: "Active", description: "Student tuition/visa funds collected for onward transmission to institutions." },
  { code: "2130", name: "Employee-Related Payables", level: 3, parentCode: "2100", type: "Liability", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Amounts payable to employees." },
  { code: "2131", name: "Salary Payable", level: 4, parentCode: "2130", type: "Liability", classification: "Current liability", normalBalance: "Credit", isPosting: true, status: "Active", description: "Net salary earned by staff but unpaid at month end." },
  { code: "2140", name: "Statutory Payroll Payables", level: 3, parentCode: "2100", type: "Liability", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Payroll deductions and employer contributions awaiting deposit." },
  { code: "2141", name: "Employee SSF Payable", level: 4, parentCode: "2140", type: "Liability", classification: "Current liability", normalBalance: "Credit", isPosting: true, status: "Active", description: "Social Security Fund (SSF Nepal) employee deduction payable." },
  { code: "2142", name: "Employer SSF Payable", level: 4, parentCode: "2140", type: "Liability", classification: "Current liability", normalBalance: "Credit", isPosting: true, status: "Active", description: "Social Security Fund employer contribution accrued." },
  { code: "2150", name: "Tax Payables", level: 3, parentCode: "2100", type: "Liability", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Taxes collected, withheld or accrued but not yet deposited." },
  { code: "2151", name: "VAT Payable", level: 4, parentCode: "2150", type: "Liability", classification: "Current liability", normalBalance: "Credit", isPosting: true, status: "Active", description: "Output VAT net payable to Inland Revenue Department (IRD Nepal)." },
  { code: "2152", name: "TDS Payable – Rent", level: 4, parentCode: "2150", type: "Liability", classification: "Current liability", normalBalance: "Credit", isPosting: true, status: "Active", description: "Tax deducted at source on office premises rent." },
  { code: "2153", name: "TDS Payable – Salary", level: 4, parentCode: "2150", type: "Liability", classification: "Current liability", normalBalance: "Credit", isPosting: true, status: "Active", description: "TDS withheld from employee salary." },

  // 3000 Equity
  { code: "3000", name: "Equity", level: 1, type: "Equity", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Owners' residual interest in the company." },
  { code: "3100", name: "Share Capital", level: 2, parentCode: "3000", type: "Equity", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Issued and paid-up capital structure." },
  { code: "3130", name: "Paid-Up Share Capital", level: 3, parentCode: "3100", type: "Equity", classification: "Equity", normalBalance: "Credit", isPosting: true, status: "Active", description: "Total paid-up capital of AECS Pvt. Ltd." },
  { code: "3400", name: "Retained Earnings", level: 2, parentCode: "3000", type: "Equity", classification: "Equity", normalBalance: "Credit", isPosting: true, status: "Active", description: "Accumulated undistributed profits or losses from prior years." },
  { code: "3500", name: "Current-Year Profit or Loss", level: 2, parentCode: "3000", type: "Equity", classification: "Equity", normalBalance: "Credit", isPosting: true, status: "Active", description: "Current financial year's net operating result." },
  { code: "3900", name: "Opening Balance Equity", level: 2, parentCode: "3000", type: "Equity", classification: "Migration Account", normalBalance: "Credit", isPosting: true, status: "Active", description: "Temporary account for opening balance migration; clear after reconciliation." },

  // 4000 Operating Income
  { code: "4000", name: "Operating Income", level: 1, type: "Income", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Income from core education consultancy activities." },
  { code: "4100", name: "Education Consultancy Service Income", level: 2, parentCode: "4000", type: "Income", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Fees earned from student counselling and admissions." },
  { code: "4111", name: "Student Counselling Income", level: 3, parentCode: "4100", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Counselling and profile evaluation fees." },
  { code: "4112", name: "Application Processing Income", level: 3, parentCode: "4100", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Fees earned for university and college application processing." },
  { code: "4113", name: "Documentation Service Income", level: 3, parentCode: "4100", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "SOP, CV, and financial documentation checking assistance." },
  { code: "4114", name: "Visa Processing Service Income", level: 3, parentCode: "4100", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Visa file preparation and lodgement advisory fees." },
  { code: "4200", name: "University & Partner Commission Income", level: 2, parentCode: "4000", type: "Income", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Commission and recruitment incentives from overseas institutions." },
  { code: "4211", name: "University Commission – UK", level: 3, parentCode: "4200", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Direct commission received from UK partner institutions." },
  { code: "4212", name: "University Commission – Australia", level: 3, parentCode: "4200", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Commission received from Australian universities/colleges." },
  { code: "4213", name: "University Commission – Canada", level: 3, parentCode: "4200", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Commission received from Canadian institutions." },
  { code: "4214", name: "University Commission – USA & Europe", level: 3, parentCode: "4200", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Commission received from USA, Germany, Finland, Ireland." },
  { code: "4219", name: "B2B Partner Commission Income", level: 3, parentCode: "4200", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Aggregator / master agent commission revenue share." },
  { code: "4300", name: "Test Preparation Income", level: 2, parentCode: "4000", type: "Income", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Tuition and material fees for English tests." },
  { code: "4311", name: "IELTS Preparation Class Fees", level: 3, parentCode: "4300", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Student fees for IELTS preparation batches." },
  { code: "4312", name: "PTE Preparation Class Fees", level: 3, parentCode: "4300", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Student fees for PTE academic classes." },
  { code: "4313", name: "Duolingo (DET) Class Fees", level: 3, parentCode: "4300", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Student fees for Duolingo English Test training." },
  { code: "4400", name: "Language Class Income", level: 2, parentCode: "4000", type: "Income", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Language training income." },
  { code: "4411", name: "German Language Class Fees", level: 3, parentCode: "4400", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "German A1/A2/B1 level tuition fees." },
  { code: "4412", name: "Japanese Language Class Fees", level: 3, parentCode: "4400", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Japanese NAT/JLPT training fees." },
  { code: "4500", name: "Test Booking Service Income", level: 2, parentCode: "4000", type: "Income", classification: "Header", normalBalance: "Credit", isPosting: false, status: "Active", description: "Service fees or margins earned on test seat bookings." },
  { code: "4511", name: "IELTS / PTE Booking Service Margin", level: 3, parentCode: "4500", type: "Income", classification: "Revenue", normalBalance: "Credit", isPosting: true, status: "Active", description: "Service margin earned when booking test seats for students." },

  // 5000 Direct Costs
  { code: "5000", name: "Direct Costs / Cost of Services", level: 1, type: "Expense", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Costs directly attributable to student services and classes." },
  { code: "5100", name: "Direct Consultancy Costs", level: 2, parentCode: "5000", type: "Expense", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Direct sub-agent commissions and external filing fees." },
  { code: "5111", name: "Sub-Agent / B2B Commission Expense", level: 3, parentCode: "5100", type: "Expense", classification: "Direct cost", normalBalance: "Debit", isPosting: true, status: "Active", description: "Commission share paid to partner agents on student enrolment." },
  { code: "5113", name: "Counsellor Conversion Incentive", level: 3, parentCode: "5100", type: "Expense", classification: "Direct cost", normalBalance: "Debit", isPosting: true, status: "Active", description: "Performance-linked conversion incentive paid to counsellors." },
  { code: "5200", name: "Test Preparation Direct Costs", level: 2, parentCode: "5000", type: "Expense", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Instructor fees and test platforms." },
  { code: "5211", name: "IELTS Instructor Teaching Cost", level: 3, parentCode: "5200", type: "Expense", classification: "Direct cost", normalBalance: "Debit", isPosting: true, status: "Active", description: "Direct teaching hours paid to IELTS instructors." },
  { code: "5212", name: "PTE Instructor Teaching Cost", level: 3, parentCode: "5200", type: "Expense", classification: "Direct cost", normalBalance: "Debit", isPosting: true, status: "Active", description: "Direct teaching hours paid to PTE instructors." },
  { code: "5216", name: "Mock Test & Portal Platform Cost", level: 3, parentCode: "5200", type: "Expense", classification: "Direct cost", normalBalance: "Debit", isPosting: true, status: "Active", description: "Subscription fees for online student practice test software." },

  // 6000 Operating Expenses
  { code: "6000", name: "Operating Expenses", level: 1, type: "Expense", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Administrative, staff, marketing and facilities overheads." },
  { code: "6100", name: "Employee & HR Expenses", level: 2, parentCode: "6000", type: "Expense", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Staff remuneration, welfare and statutory benefits." },
  { code: "6111", name: "Basic Salary Expense", level: 3, parentCode: "6100", type: "Expense", classification: "Expense", normalBalance: "Debit", isPosting: true, status: "Active", description: "Salaries paid to administrative and counselling staff." },
  { code: "6119", name: "Festival Allowance (Dashain / Tihar)", level: 3, parentCode: "6100", type: "Expense", classification: "Expense", normalBalance: "Debit", isPosting: true, status: "Active", description: "Statutory festival allowance under Nepal Labor Act." },
  { code: "6121", name: "Employer SSF Contribution Expense", level: 3, parentCode: "6100", type: "Expense", classification: "Expense", normalBalance: "Debit", isPosting: true, status: "Active", description: "Employer 20% contribution to Social Security Fund Nepal." },
  { code: "6200", name: "Administrative & Premises Expenses", level: 2, parentCode: "6000", type: "Expense", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Office rent, utilities and routine maintenance." },
  { code: "6211", name: "Office Rent Expense", level: 3, parentCode: "6200", type: "Expense", classification: "Expense", normalBalance: "Debit", isPosting: true, status: "Active", description: "Monthly lease rent for AECS central consultancy office." },
  { code: "6212", name: "Learning Center Rent Expense", level: 3, parentCode: "6200", type: "Expense", classification: "Expense", normalBalance: "Debit", isPosting: true, status: "Active", description: "Rent for classroom / test preparation premises." },
  { code: "6300", name: "Marketing & Lead Generation", level: 2, parentCode: "6000", type: "Expense", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Digital ads, education fairs, and brand promotions." },
  { code: "6311", name: "Meta (Facebook / Instagram) Advertising", level: 3, parentCode: "6300", type: "Expense", classification: "Expense", normalBalance: "Debit", isPosting: true, status: "Active", description: "Online lead generation campaigns." },
  { code: "6314", name: "Google Ads & Search Marketing", level: 3, parentCode: "6300", type: "Expense", classification: "Expense", normalBalance: "Debit", isPosting: true, status: "Active", description: "Search engine ads for study abroad queries." },
  { code: "6317", name: "Education Fairs & Seminars", level: 3, parentCode: "6300", type: "Expense", classification: "Expense", normalBalance: "Debit", isPosting: true, status: "Active", description: "Events, venue booking and institution fair stalls." },
  { code: "6400", name: "Technology & Software Subscriptions", level: 2, parentCode: "6000", type: "Expense", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "Cloud software, SMS, CRM and Google Workspace." },
  { code: "6411", name: "CRM & Cloud Infrastructure", level: 3, parentCode: "6400", type: "Expense", classification: "Expense", normalBalance: "Debit", isPosting: true, status: "Active", description: "Hosting, Supabase, and Netlify hosting infrastructure." },
  { code: "6418", name: "SMS & WhatsApp Business API", level: 3, parentCode: "6400", type: "Expense", classification: "Expense", normalBalance: "Debit", isPosting: true, status: "Active", description: "Automated student follow-up reminders and alerts." },

  // 8000 Control Accounts
  { code: "8000", name: "Control Accounts", level: 1, type: "Control", classification: "Header", normalBalance: "Debit", isPosting: false, status: "Active", description: "System control and clearing ledgers." },
  { code: "8110", name: "Inter-branch Current Account", level: 2, parentCode: "8000", type: "Control", classification: "Control account", normalBalance: "Debit", isPosting: true, status: "Active", description: "Reconciliation ledger for multi-branch cash transfers." },
  { code: "8120", name: "Cash and Bank Clearing", level: 2, parentCode: "8000", type: "Control", classification: "Control account", normalBalance: "Debit", isPosting: true, status: "Active", description: "In-transit clearing between cash counter and bank deposits." },
  { code: "8140", name: "Suspense Account", level: 2, parentCode: "8000", type: "Control", classification: "Control account", normalBalance: "Debit", isPosting: true, status: "Active", description: "Unidentified direct student deposits awaiting verification." },
];

export const DEACTIVATED_LEGACY_ACCOUNTS = [
  { pattern: "Income-Bio Pesticides / COGS / Assets", reason: "Agricultural trading account; completely unrelated to education consultancy.", action: "Deactivate after zero balance confirmed", mapping: "No replacement" },
  { pattern: "Income-Chemical Fertilizer / COGS", reason: "Agricultural trading account.", action: "Deactivate", mapping: "No replacement" },
  { pattern: "Income-FMCG / COGS-FMCG", reason: "General trading inventory account.", action: "Deactivate", mapping: "Material Sales Income if stationery" },
  { pattern: "Income-Seeds / Sprayers / Farm Tools", reason: "Farming machinery and supplies.", action: "Deactivate", mapping: "No replacement" },
  { pattern: "Duplicate Advertisement Expenses", reason: "Duplicate ledger causes inconsistent posting.", action: "Merge and deactivate duplicates", mapping: "6300 Marketing Expenses" },
  { pattern: "Generic Other Income / Other Expense", reason: "Overuse hides true nature of transactions.", action: "Map recurring items to specific accounts", mapping: "4718 / 6235 / 6819" },
  { pattern: "Foreigh Exchange Loss (Typo)", reason: "Typographical error in legacy ledger.", action: "Merge into 6617 Foreign Exchange Loss", mapping: "6617 Foreign Exchange Loss" },
  { pattern: "Travalling Expenses (Typo)", reason: "Typographical error in legacy ledger.", action: "Merge into 6228 Travel Expense", mapping: "6228 Travel Expense" },
];
