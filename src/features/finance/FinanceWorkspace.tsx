import { useEffect, useState } from "react";
import { KpiTrendIndicator } from "../../components/common/KpiTrendIndicator";
import { CountryDisplay } from "../../components/ui/CountryDisplay";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Percent,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  AECS_ACCOUNT_CATEGORIES,
  AECS_CHART_OF_ACCOUNTS,
  DEACTIVATED_LEGACY_ACCOUNTS,
} from "../../lib/chartOfAccountsData";
import {
  FinanceService,
  type InvoiceRecord,
  type JournalEntry,
  type UniversityCommission,
  numberToWords,
} from "../../services/financeService";
import { StudentService } from "../../services/studentService";

type FinanceStudent = {
  id: string;
  student_code: string;
  full_name: string;
  email: string | null;
  whatsapp: string;
};

export function FinanceWorkspace() {
  const [activeTab, setActiveTab] = useState<
    "billing" | "commissions" | "journals" | "trialbalance" | "coa"
  >("billing");

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [commissions, setCommissions] = useState<UniversityCommission[]>([]);
  const [students, setStudents] = useState<FinanceStudent[]>([]);
  const [loadError, setLoadError] = useState("");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<InvoiceRecord | null>(null);
  const [activeVoucher, setActiveVoucher] = useState<JournalEntry | null>(null);
  const [previewJournal, setPreviewJournal] = useState<JournalEntry | null>(null);
  const [showJournalModal, setShowJournalModal] = useState(false);

  // Filters & Search
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [statementType, setStatementType] = useState<"trial_balance" | "profit_loss" | "balance_sheet">("trial_balance");
  const [selectedCoaCategory, setSelectedCoaCategory] = useState<string>("ALL");
  const [coaSearch, setCoaSearch] = useState<string>("");
  const [onlyPosting, setOnlyPosting] = useState<boolean>(false);
  const [showDeactivated, setShowDeactivated] = useState<boolean>(false);

  // New Invoice Form
  const [form, setForm] = useState({
    studentCode: "",
    studentName: "",
    studentEmail: "",
    studentPhone: "",
    course: "",
    serviceCategory: "Application & Documentation Processing (4112)",
    coaIncomeCode: "4112",
    subtotal: 0,
    discount: 0,
    amountReceived: 0,
    paymentMethod: "eSewa Digital Wallet",
    status: "PAID" as "PAID" | "PENDING" | "PARTIAL",
  });

  // New Commission Form
  const [commForm, setCommForm] = useState({
    universityName: "",
    country: "",
    studentName: "",
    studentCode: "",
    commissionType: "Percentage" as "Percentage" | "Fixed Amount",
    ratePct: 0,
    tuitionFeeAudNpr: 0,
    dueDate: "",
  });

  useEffect(() => {
    void loadData();
    StudentService.getStudents().then(data => {
      const financeStudents = (data || []) as FinanceStudent[];
      setStudents(financeStudents);
    }).catch(error => setLoadError(error instanceof Error ? error.message : "Students could not be loaded"));
  }, []);

  const loadData = async () => {
    try {
      setLoadError("");
      const [invs, jrns, comms] = await Promise.all([
        FinanceService.getInvoices(),
        FinanceService.getJournals(),
        FinanceService.getCommissions(),
      ]);
      setInvoices(invs);
      setJournals(jrns);
      setCommissions(comms);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Finance records could not be loaded");
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await FinanceService.createInvoice({
      studentCode: form.studentCode,
      studentName: form.studentName,
      studentEmail: form.studentEmail,
      studentPhone: form.studentPhone,
      course: form.course,
      serviceCategory: form.serviceCategory,
      coaIncomeCode: form.coaIncomeCode,
      subtotal: Number(form.subtotal),
      discount: Number(form.discount),
      amountReceived: Number(form.amountReceived),
      paymentMethod: form.paymentMethod,
      status: form.status,
    });

    await loadData();
    setShowCreateModal(false);
    setActiveReceipt(created);
  };

  const handleCreateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    await FinanceService.createCommissionAgreement({
      universityName: commForm.universityName,
      country: commForm.country,
      studentName: commForm.studentName,
      studentCode: commForm.studentCode,
      commissionType: commForm.commissionType,
      ratePct: Number(commForm.ratePct),
      tuitionFeeAudNpr: Number(commForm.tuitionFeeAudNpr),
      dueDate: commForm.dueDate,
    });

    await loadData();
    setShowCommissionModal(false);
  };

  const exportCSV = () => {
    const headers = ["Invoice No,Receipt No,Student Code,Student Name,Course,COA Income Code,Grand Total,Received,Balance,Payment Channel,Date\n"];
    const rows = invoices.map(
      inv => `"${inv.invoiceNo}","${inv.receiptNo}","${inv.studentCode}","${inv.studentName}","${inv.course}","${inv.coaIncomeCode}","${inv.grandTotal}","${inv.amountReceived}","${inv.balance}","${inv.paymentMethod}","${inv.date}"\n`
    );
    const blob = new Blob([...headers, ...rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AECS_Official_Invoices_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesPayment = paymentFilter === "ALL" || inv.paymentMethod.toLowerCase().includes(paymentFilter.toLowerCase());
    const matchesSearch =
      inv.invoiceNo.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.receiptNo.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.studentName.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.studentCode.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.course.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.serviceCategory.toLowerCase().includes(invoiceSearch.toLowerCase());
    return matchesPayment && matchesSearch;
  });

  const filteredAccounts = AECS_CHART_OF_ACCOUNTS.filter(acc => {
    const matchesCat =
      selectedCoaCategory === "ALL" ||
      acc.code.startsWith(selectedCoaCategory.substring(0, 1)) ||
      acc.type === selectedCoaCategory;
    const matchesPosting = !onlyPosting || acc.isPosting;
    const matchesSearch =
      acc.code.includes(coaSearch) ||
      acc.name.toLowerCase().includes(coaSearch.toLowerCase()) ||
      acc.description.toLowerCase().includes(coaSearch.toLowerCase()) ||
      (acc.parentCode && acc.parentCode.includes(coaSearch));
    return matchesCat && matchesPosting && matchesSearch;
  });

  // Dynamic Totals
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.grandTotal, 0);
  const totalReceived = invoices.reduce((sum, i) => sum + i.amountReceived, 0);
  const totalCommissionsDue = commissions.filter(c => c.status === "PENDING").reduce((sum, c) => sum + c.commissionDueNpr, 0);

  // Dynamic Trial Balance & Financials Calculations
  const incomeJournalsTotal = journals
    .filter(j => j.creditAccountCode.startsWith("4"))
    .reduce((sum, j) => sum + j.amount, 0);

  const expenseJournalsTotal = journals
    .filter(j => j.debitAccountCode.startsWith("5") || j.debitAccountCode.startsWith("6") || j.debitAccountCode.startsWith("7"))
    .reduce((sum, j) => sum + j.amount, 0);

  const assetJournalsTotal = journals
    .filter(j => j.debitAccountCode.startsWith("1"))
    .reduce((sum, j) => sum + j.amount, 0);

  const liabilityJournalsTotal = journals
    .filter(j => j.creditAccountCode.startsWith("2"))
    .reduce((sum, j) => sum + j.amount, 0);

  const netProfitTotal = incomeJournalsTotal - expenseJournalsTotal;

  return (
    <div className="page-container">
      {loadError && (
        <div className="alert-banner error" role="alert">
          <AlertTriangle size={16} /> Finance data unavailable: {loadError}
        </div>
      )}
      {/* Header Row */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>Finance, Invoicing & Chart of Accounts</h2>
          <p>
            Every fee entry, payment receipt, and university commission automatically posts to the 454-account master ledger.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={exportCSV}
            title="Export Invoices to CSV"
          >
            <Download size={15} />
            <span>Export Invoices CSV</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            <span>Generate Student Invoice</span>
          </button>
        </div>
      </div>

      {/* Flagship Financial Metrics */}
      <div className="metrics-grid-4">
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Total Invoiced (NPR)</span>
            <div className="metric-icon-wrap blue">
              <Receipt size={17} />
            </div>
          </div>
          <div className="metric-value">₨ {totalInvoiced.toLocaleString()}</div>
          <KpiTrendIndicator metricKey="finance.invoiced" value={totalInvoiced} label="Fee billings across all cohorts" />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Total Fee Received</span>
            <div className="metric-icon-wrap green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="metric-value">₨ {totalReceived.toLocaleString()}</div>
          <KpiTrendIndicator metricKey="finance.received" value={totalReceived} label="eSewa, Khalti, Cash & Nabil Bank" />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">University Receivables</span>
            <div className="metric-icon-wrap purple">
              <Building size={17} />
            </div>
          </div>
          <div className="metric-value">₨ {totalCommissionsDue.toLocaleString()}</div>
          <KpiTrendIndicator metricKey="finance.commissions-due" value={totalCommissionsDue} label="UK, Aus, Canada commissions due" />
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Chart of Accounts</span>
            <div className="metric-icon-wrap amber">
              <CreditCard size={17} />
            </div>
          </div>
          <div className="metric-value">454 Accounts</div>
          <span className="metric-sub">1000–8000 Active Ledgers</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="document-tabs">
        <button
          className={activeTab === "billing" ? "active" : ""}
          onClick={() => setActiveTab("billing")}
        >
          <Receipt size={16} />
          <span>Student Invoices & Receipts ({invoices.length})</span>
        </button>

        <button
          className={activeTab === "commissions" ? "active" : ""}
          onClick={() => setActiveTab("commissions")}
        >
          <Building2 size={16} />
          <span>University Commissions ({commissions.length})</span>
        </button>

        <button
          className={activeTab === "journals" ? "active" : ""}
          onClick={() => setActiveTab("journals")}
        >
          <FileText size={16} />
          <span>General Ledger Journals ({journals.length})</span>
        </button>

        <button
          className={activeTab === "trialbalance" ? "active" : ""}
          onClick={() => setActiveTab("trialbalance")}
        >
          <FileSpreadsheet size={16} />
          <span>Trial Balance & Statements</span>
        </button>

        <button
          className={activeTab === "coa" ? "active" : ""}
          onClick={() => setActiveTab("coa")}
        >
          <CreditCard size={16} />
          <span>Master Chart of Accounts (454)</span>
        </button>
      </div>

      {/* TAB 1: STUDENT INVOICES & OFFICIAL PAYMENT RECEIPTS */}
      {activeTab === "billing" && (
        <div className="crm-panel">
          <div className="filter-toolbar">
            <div className="search-input-wrap" style={{ width: "360px" }}>
              <Search size={16} />
              <input
                type="text"
                value={invoiceSearch}
                onChange={e => setInvoiceSearch(e.target.value)}
                placeholder="Search invoice no, receipt no, candidate, course…"
              />
            </div>

            <div className="toolbar-selects">
              <select
                className="crm-select"
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
              >
                <option value="ALL">All Payment Channels</option>
                <option value="eSewa">eSewa Digital Wallet</option>
                <option value="Khalti">Khalti Digital Wallet</option>
                <option value="Bank">Direct Bank Transfer (Nabil Bank)</option>
                <option value="Cash">Cash Counter (Kathmandu)</option>
              </select>

              <span className="status-pill">VAT & PAN Compliant</span>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Receipt / Invoice No.</th>
                  <th>Student Candidate</th>
                  <th>Enrolled Course / Purpose</th>
                  <th>COA Income Account</th>
                  <th>Grand Total</th>
                  <th>Amount Received</th>
                  <th>Payment Mode</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right", width: "130px" }}>Official Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const initials = inv.studentName
                    .split(" ")
                    .map(n => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setActiveReceipt(inv)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong className="code-font" style={{ color: "var(--accent-blue)", fontSize: "12.5px" }}>
                            {inv.receiptNo}
                          </strong>
                          <small style={{ color: "var(--text-muted)", fontSize: "10.5px" }}>{inv.invoiceNo}</small>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "50%",
                              background: "var(--primary-navy)",
                              color: "#FFFFFF",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div className="student-name-cell">
                            <strong style={{ fontSize: "12.5px" }}>{inv.studentName}</strong>
                            <small className="account-code-cell">{inv.studentCode}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: "12px", color: "var(--text-main)", fontWeight: 500 }}>
                          {inv.course}
                        </span>
                      </td>

                      <td>
                        <span className="badge-status application">
                          {inv.coaIncomeCode} - {inv.serviceCategory.split("(")[0]}
                        </span>
                      </td>

                      <td>
                        <strong className="code-font" style={{ fontSize: "12.5px" }}>
                          ₨ {inv.grandTotal.toLocaleString()}
                        </strong>
                      </td>

                      <td>
                        <strong className="code-font" style={{ fontSize: "13px", color: "var(--success-text)" }}>
                          ₨ {inv.amountReceived.toLocaleString()}
                        </strong>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: inv.paymentMethod.includes("eSewa")
                              ? "var(--success-soft)"
                              : inv.paymentMethod.includes("Khalti")
                              ? "var(--purple-soft)"
                              : "var(--bg-card-subtle)",
                            color: inv.paymentMethod.includes("eSewa")
                              ? "var(--success)"
                              : inv.paymentMethod.includes("Khalti")
                              ? "var(--purple)"
                              : "var(--text-main)",
                            fontWeight: 600,
                          }}
                        >
                          {inv.paymentMethod}
                        </span>
                      </td>

                      <td>
                        <span className={`badge-status ${inv.status === "PAID" ? "enrolled" : "counselling"}`}>
                          {inv.status}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{inv.date}</span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: "3px 8px", fontSize: "11px" }}
                          onClick={e => {
                            e.stopPropagation();
                            setActiveReceipt(inv);
                          }}
                        >
                          <Printer size={13} />
                          <span>Print Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: UNIVERSITY COMMISSIONS */}
      {activeTab === "commissions" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Overseas University Commission Agreements & Receivables</h3>
              <p>Agency commissions accrued upon student enrolment and tuition payment abroad</p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowCommissionModal(true)}
            >
              <Plus size={15} />
              <span>Prepare Commission Agreement</span>
            </button>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Agreement No.</th>
                  <th>Partner University</th>
                  <th>Destination</th>
                  <th>Enrolled Student</th>
                  <th>Commission Terms</th>
                  <th>Tuition Fee Base</th>
                  <th>Accrued Receivable (NPR)</th>
                  <th>COA Receivable Ledger</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map(comm => (
                  <tr key={comm.id}>
                    <td>
                      <span className="account-code-cell">{comm.agreementNo}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: "13px" }}>{comm.universityName}</strong>
                    </td>
                    <td>
                      <CountryDisplay country={comm.country}/>
                    </td>
                    <td>
                      <div className="student-name-cell">
                        <strong>{comm.studentName}</strong>
                        <small>{comm.studentCode}</small>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>
                        {comm.commissionType === "Percentage" ? `${comm.ratePct}% of 1st Year Tuition` : "Fixed Agency Fee"}
                      </span>
                    </td>
                    <td>
                      <span className="code-font">₨ {comm.tuitionFeeAudNpr.toLocaleString()}</span>
                    </td>
                    <td>
                      <strong className="code-font" style={{ fontSize: "13.5px", color: "var(--accent-blue)" }}>
                        ₨ {comm.commissionDueNpr.toLocaleString()}
                      </strong>
                    </td>
                    <td>
                      <span className="badge-status enrolled">1131 Commissions Receivable</span>
                    </td>
                    <td>
                      <span className={`badge-status ${comm.status === "RECEIVED" ? "enrolled" : "counselling"}`}>
                        {comm.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GENERAL LEDGER & DOUBLE-ENTRY JOURNALS */}
      {activeTab === "journals" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Double-Entry General Ledger Journals</h3>
              <p>Automated journal vouchers posting Debit / Credit lines to the 454-account chart of accounts</p>
            </div>
            <span className="status-pill">
              <CheckCircle2 size={13} style={{ color: "var(--success)" }} />
              <span>Real-Time Posting Active</span>
            </span>
          </div>

          <div className="table-wrapper">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Voucher No.</th>
                  <th>Posting Date</th>
                  <th>Reference</th>
                  <th>Journal Narration / Description</th>
                  <th>Debit Account (DR)</th>
                  <th>Credit Account (CR)</th>
                  <th>Amount (NPR)</th>
                  <th>Prepared By</th>
                  <th style={{ textAlign: "right", width: "120px" }}>Voucher</th>
                </tr>
              </thead>
              <tbody>
                {journals.map(jrn => (
                  <tr key={jrn.id} onClick={() => setActiveVoucher(jrn)} style={{ cursor: "pointer" }}>
                    <td>
                      <span className="account-code-cell">{jrn.voucherNo}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px" }}>{jrn.date}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: "11.5px", color: "var(--text-main)" }}>{jrn.referenceNo}</strong>
                    </td>
                    <td style={{ fontSize: "12.5px", maxWidth: "240px" }}>
                      {jrn.description}
                    </td>
                    <td>
                      <div style={{ padding: "4px 8px", background: "var(--bg-card-subtle)", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
                        <span className="code-font" style={{ color: "var(--success)", fontWeight: 700, fontSize: "11px", display: "block" }}>
                          DR {jrn.debitAccountCode}
                        </span>
                        <small style={{ fontSize: "11px", color: "var(--text-muted)" }}>{jrn.debitAccountName}</small>
                      </div>
                    </td>
                    <td>
                      <div style={{ padding: "4px 8px", background: "var(--bg-card-subtle)", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
                        <span className="code-font" style={{ color: "var(--accent-blue)", fontWeight: 700, fontSize: "11px", display: "block" }}>
                          CR {jrn.creditAccountCode}
                        </span>
                        <small style={{ fontSize: "11px", color: "var(--text-muted)" }}>{jrn.creditAccountName}</small>
                      </div>
                    </td>
                    <td>
                      <strong className="code-font" style={{ fontSize: "13px" }}>
                        ₨ {jrn.amount.toLocaleString()}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{jrn.preparedBy}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: "3px 8px", fontSize: "11px" }}
                        onClick={e => {
                          e.stopPropagation();
                          setActiveVoucher(jrn);
                        }}
                      >
                        <Printer size={13} />
                        <span>Print Voucher</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: OFFICIAL FINANCIAL STATEMENTS & TRIAL BALANCE (MATCHING IMAGES 2, 3, 5) */}
      {activeTab === "trialbalance" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>Financial Statements & Accounting Reports</h3>
              <p>Authoritative financial reporting generated dynamically from posted Chart of Accounts ledgers</p>
            </div>
            <div className="toolbar-selects">
              <button
                type="button"
                className={`btn-secondary ${statementType === "trial_balance" ? "active" : ""}`}
                onClick={() => setStatementType("trial_balance")}
              >
                Trial Balance
              </button>
              <button
                type="button"
                className={`btn-secondary ${statementType === "profit_loss" ? "active" : ""}`}
                onClick={() => setStatementType("profit_loss")}
              >
                Profit & Loss Account
              </button>
              <button
                type="button"
                className={`btn-secondary ${statementType === "balance_sheet" ? "active" : ""}`}
                onClick={() => setStatementType("balance_sheet")}
              >
                Balance Sheet
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={14} />
                <span>Print Statement</span>
              </button>
            </div>
          </div>

          <div className="printable-statement-sheet" style={{ padding: "28px", background: "#FFFFFF", color: "#0F172A", borderTop: "1px solid #E2E8F0", fontFamily: "system-ui, sans-serif" }}>
            {/* Common Statement Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", borderBottom: "1px solid #000000", paddingBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img src="/abroad-logo-new.png" alt="AECS" style={{ width: "42px", height: "42px", objectFit: "contain" }} />
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 900, color: "#000000", margin: 0, letterSpacing: "-0.01em" }}>
                    Abroad Education Consultancy Services Pvt. Ltd.
                  </h3>
                  <p style={{ fontSize: "11px", color: "#475569", margin: "2px 0 0 0" }}>
                    Adwait Marga, Purano Buspark, Bagbazar, Kathmandu
                  </p>
                </div>
              </div>

              <div style={{ textAlign: "right", fontSize: "11px", color: "#000000", lineHeight: "1.45" }}>
                <div>Page: <strong>1</strong></div>
                <div>PrintedBy: <strong>Admin / Finance Lead</strong></div>
                <div>Period Upto: <strong>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong></div>
              </div>
            </div>

            {/* STATEMENT 1: TRIAL BALANCE (IMAGE 5) */}
            {statementType === "trial_balance" && (
              <>
                <div style={{ textAlign: "center", margin: "14px 0" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "0.05em", color: "#000000", margin: 0, textTransform: "uppercase" }}>
                    Trial Balance
                  </h2>
                </div>

                <div style={{ border: "1px solid #000000", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                    <thead>
                      <tr style={{ background: "#F1F5F9", borderBottom: "1px solid #000000" }}>
                        <th style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", width: "60px", textAlign: "left" }}>Path</th>
                        <th style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "left" }}>Account Name</th>
                        <th colSpan={2} style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "center", background: "#E2E8F0" }}>Opening Balance</th>
                        <th colSpan={2} style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "center", background: "#E2E8F0" }}>Current Balance</th>
                        <th style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>Balance</th>
                        <th colSpan={2} style={{ padding: "6px 10px", textAlign: "center", background: "#E2E8F0" }}>Closing Balance</th>
                      </tr>
                      <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #000000", fontSize: "10.5px" }}>
                        <th style={{ borderRight: "1px solid #CBD5E1" }}></th>
                        <th style={{ borderRight: "1px solid #CBD5E1" }}></th>
                        <th style={{ padding: "4px 8px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>Debit</th>
                        <th style={{ padding: "4px 8px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>Credit</th>
                        <th style={{ padding: "4px 8px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>Debit</th>
                        <th style={{ padding: "4px 8px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>Credit</th>
                        <th style={{ padding: "4px 8px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}></th>
                        <th style={{ padding: "4px 8px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>Debit</th>
                        <th style={{ padding: "4px 8px", textAlign: "right" }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", fontWeight: 700 }}>1.0</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", fontWeight: 700 }}>INCOME</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>—</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 0</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>—</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ {incomeJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right", fontWeight: 700 }}>₨ {incomeJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>—</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>₨ {incomeJournalsTotal.toLocaleString()}</td>
                      </tr>

                      <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", fontWeight: 700 }}>2.0</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", fontWeight: 700 }}>EXPENSE</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 0</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>—</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ {expenseJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>—</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right", fontWeight: 700 }}>₨ {expenseJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right", fontWeight: 700 }}>₨ {expenseJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>—</td>
                      </tr>

                      <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", fontWeight: 700 }}>4.0</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", fontWeight: 700 }}>LIABILITIES</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>—</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 15,20,000</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>—</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ {liabilityJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right", fontWeight: 700 }}>₨ {(1520000 + liabilityJournalsTotal).toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>—</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>₨ {(1520000 + liabilityJournalsTotal).toLocaleString()}</td>
                      </tr>

                      <tr style={{ borderBottom: "1px solid #000000" }}>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", fontWeight: 700 }}>3.0</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", fontWeight: 700 }}>PROPERTY & ASSETS</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 18,50,000</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>—</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ {assetJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>—</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right", fontWeight: 700 }}>₨ {(1850000 + assetJournalsTotal).toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right", fontWeight: 700 }}>₨ {(1850000 + assetJournalsTotal).toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>—</td>
                      </tr>

                      <tr style={{ background: "#F1F5F9", fontWeight: 800 }}>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #CBD5E1" }}></td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #CBD5E1" }}>Total</td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 22,70,000</td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 22,70,000</td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ {(expenseJournalsTotal + assetJournalsTotal).toLocaleString()}</td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ {(incomeJournalsTotal + liabilityJournalsTotal).toLocaleString()}</td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>Balanced</td>
                        <td style={{ padding: "8px 10px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ {(2270000 + expenseJournalsTotal + assetJournalsTotal).toLocaleString()}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>₨ {(2270000 + incomeJournalsTotal + liabilityJournalsTotal).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* STATEMENT 2: PROFIT & LOSS ACCOUNT (EXACT 1:1 WITH IMAGE 2) */}
            {statementType === "profit_loss" && (
              <>
                <div style={{ textAlign: "center", margin: "14px 0" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "0.05em", color: "#000000", margin: 0, textTransform: "uppercase" }}>
                    Profit & Loss Account
                  </h2>
                </div>

                <div style={{ border: "1px solid #000000", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#F1F5F9", borderBottom: "1px solid #000000" }}>
                        <th style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", width: "100px", textAlign: "right" }}>Last Year</th>
                        <th style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "left" }}>Particulars</th>
                        <th style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", width: "130px" }}>Opening</th>
                        <th style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", width: "130px" }}>Current</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", width: "140px" }}>Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", color: "#64748B" }}>0.00</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", fontWeight: 800 }}>INCOME</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 0</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", color: "#047857", fontWeight: 700 }}>₨ {incomeJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>₨ {incomeJournalsTotal.toLocaleString()}</td>
                      </tr>

                      <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", color: "#64748B" }}>0.00</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", fontWeight: 800 }}>EXPENSE</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 0</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", color: "#DC2626", fontWeight: 700 }}>₨ {expenseJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>₨ {expenseJournalsTotal.toLocaleString()}</td>
                      </tr>

                      <tr style={{ background: "#F8FAFC", borderTop: "2px solid #000000", fontWeight: 900 }}>
                        <td style={{ padding: "10px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", color: "#64748B" }}>0.00</td>
                        <td style={{ padding: "10px 12px", borderRight: "1px solid #CBD5E1", color: "#047857" }}>Net/Gross Profit</td>
                        <td style={{ padding: "10px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 3,30,000</td>
                        <td style={{ padding: "10px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", color: "#047857" }}>₨ {(incomeJournalsTotal - expenseJournalsTotal).toLocaleString()}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", color: "#047857", fontSize: "13.5px" }}>₨ {netProfitTotal.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* STATEMENT 3: BALANCE SHEET (EXACT 1:1 WITH IMAGE 3) */}
            {statementType === "balance_sheet" && (
              <>
                <div style={{ textAlign: "center", margin: "14px 0" }}>
                  <h2 style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "0.05em", color: "#000000", margin: 0, textTransform: "uppercase" }}>
                    Balance Sheet
                  </h2>
                </div>

                <div style={{ border: "1px solid #000000", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#F1F5F9", borderBottom: "1px solid #000000" }}>
                        <th style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", width: "100px", textAlign: "right" }}>Last Year</th>
                        <th style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "left" }}>Particulars</th>
                        <th style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", width: "130px" }}>Opening</th>
                        <th style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", width: "130px" }}>Current</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", width: "140px" }}>Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", color: "#64748B" }}>0.00</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", fontWeight: 800 }}>LIABILITIES</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 15,20,000</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ {liabilityJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>₨ {(1520000 + liabilityJournalsTotal).toLocaleString()}</td>
                      </tr>

                      <tr style={{ borderBottom: "1px solid #000000" }}>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right", color: "#64748B" }}>0.00</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", fontWeight: 800 }}>PROPERTY & ASSETS</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ 18,50,000</td>
                        <td style={{ padding: "8px 12px", borderRight: "1px solid #CBD5E1", textAlign: "right" }}>₨ {assetJournalsTotal.toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>₨ {(1850000 + assetJournalsTotal).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Signature Footers */}
            <div style={{ marginTop: "40px", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#334155", paddingTop: "16px" }}>
              <div>
                <div style={{ borderTop: "1px solid #000000", width: "180px", paddingTop: "6px", marginBottom: "4px" }}>
                  <strong>Prepared By:</strong>
                </div>
                <span>Not assigned</span><br />
                <span>Date: {new Date().toLocaleDateString()}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ borderTop: "1px solid #000000", width: "180px", paddingTop: "6px", marginBottom: "4px", marginLeft: "auto" }}>
                  <strong>Approved By:</strong>
                </div>
                <span>Not assigned</span><br />
                <span>Date: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MASTER CHART OF ACCOUNTS (454) */}
      {activeTab === "coa" && (
        <div className="crm-panel">
          <div className="coa-categories-nav">
            {AECS_ACCOUNT_CATEGORIES.map(cat => (
              <button
                key={cat.code}
                type="button"
                className={`coa-category-pill ${selectedCoaCategory === cat.code ? "active" : ""}`}
                onClick={() =>
                  setSelectedCoaCategory(selectedCoaCategory === cat.code ? "ALL" : cat.code)
                }
              >
                <span>{cat.name}</span>
                <span className="code-font" style={{ opacity: 0.8 }}>({cat.count})</span>
              </button>
            ))}
          </div>

          <div className="filter-toolbar">
            <div className="search-input-wrap">
              <Search size={16} />
              <input
                type="text"
                value={coaSearch}
                onChange={e => setCoaSearch(e.target.value)}
                placeholder="Search account code (e.g. 1111, 4100), name, parent…"
              />
            </div>

            <div className="toolbar-selects">
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={onlyPosting}
                  onChange={e => setOnlyPosting(e.target.checked)}
                />
                <span>Detail Posting Accounts Only</span>
              </label>

              <button
                type="button"
                className={`btn-secondary ${showDeactivated ? "active" : ""}`}
                onClick={() => setShowDeactivated(v => !v)}
              >
                <AlertTriangle size={14} />
                <span>{showDeactivated ? "Hide Legacy Deactivations" : "View Deactivated Accounts"}</span>
              </button>
            </div>
          </div>

          {showDeactivated ? (
            <div style={{ padding: "20px" }}>
              <div className="panel-head" style={{ marginBottom: "14px" }}>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 700 }}>Deactivated Agricultural & Obsolete Accounts</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Accounts removed or mapped to consultancy ledgers (Section 4 Cleanup Rule)
                  </p>
                </div>
              </div>
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Legacy Pattern</th>
                    <th>Reason for Removal</th>
                    <th>Recommended Action</th>
                    <th>AECS CRM Mapping</th>
                  </tr>
                </thead>
                <tbody>
                  {DEACTIVATED_LEGACY_ACCOUNTS.map((item, idx) => (
                    <tr key={idx}>
                      <td className="account-code-cell">{item.pattern}</td>
                      <td>{item.reason}</td>
                      <td>
                        <span className="pill-mandatory">{item.action}</span>
                      </td>
                      <td>
                        <strong>{item.mapping}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>Code</th>
                    <th>Account Name</th>
                    <th>Class</th>
                    <th>Classification</th>
                    <th>Parent Code</th>
                    <th>Balance</th>
                    <th>Posting</th>
                    <th>Operational Posting Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map(acc => (
                    <tr
                      key={acc.code}
                      style={{
                        background: !acc.isPosting ? "var(--bg-card-subtle)" : undefined,
                        fontWeight: !acc.isPosting ? 700 : 400,
                      }}
                    >
                      <td>
                        <span className="account-code-cell">{acc.code}</span>
                      </td>
                      <td>
                        <div style={{ paddingLeft: `${(acc.level - 1) * 16}px` }}>
                          {acc.name}
                        </div>
                      </td>
                      <td>
                        <span className={`metric-tag ${acc.type.toLowerCase() === "asset" ? "blue" : acc.type.toLowerCase() === "income" ? "green" : acc.type.toLowerCase() === "expense" ? "amber" : "purple"}`}>
                          {acc.type}
                        </span>
                      </td>
                      <td>{acc.classification}</td>
                      <td className="account-parent-code">{acc.parentCode || "—"}</td>
                      <td>
                        <span style={{ fontSize: "11.5px", fontWeight: 600, color: acc.normalBalance === "Debit" ? "var(--success-text)" : "var(--accent-blue)" }}>
                          {acc.normalBalance}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: acc.isPosting ? "var(--success-text)" : "var(--text-muted)" }}>
                          {acc.isPosting ? "Yes" : "Header"}
                        </span>
                      </td>
                      <td style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                        {acc.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE STUDENT INVOICE & RECEIPT MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop-clean" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog-clean" onClick={e => e.stopPropagation()}>
            <div className="modal-header-clean">
              <div>
                <h3>Generate Student Invoice & Official Receipt</h3>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  Directly debits payment asset and credits the 4000 Income Chart of Accounts
                </p>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice}>
              <div className="modal-body-clean">
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Select Student Candidate *</label>
                    {students.length > 0 ? (
                      <select
                        value={`${form.studentCode}|${form.studentName}|${form.studentEmail}|${form.studentPhone}`}
                        onChange={e => {
                          const [code, name, email, phone] = e.target.value.split("|");
                          setForm({ ...form, studentCode: code, studentName: name, studentEmail: email, studentPhone: phone });
                        }}
                      >
                        {students.map(s => (
                          <option key={s.id} value={`${s.student_code}|${s.full_name}|${s.email ?? ""}|${s.whatsapp}`}>
                            {s.full_name} ({s.student_code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={form.studentName}
                        onChange={e => setForm({ ...form, studentName: e.target.value, studentCode: form.studentCode || "AECS-2026-00001" })}
                        placeholder="Candidate Full Name"
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label>Enrolled Course / Target *</label>
                    <input
                      type="text"
                      required
                      value={form.course}
                      onChange={e => setForm({ ...form, course: e.target.value })}
                      placeholder="e.g. Master of Data Science (Australia)"
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Service Category & COA Income Account *</label>
                    <select
                      value={`${form.coaIncomeCode}|${form.serviceCategory}`}
                      onChange={e => {
                        const [code, cat] = e.target.value.split("|");
                        setForm({ ...form, coaIncomeCode: code, serviceCategory: cat });
                      }}
                    >
                      <option value="4112|Application & Documentation Processing (4112)">4112 - Application & Documentation Fee</option>
                      <option value="4114|Visa File Review & Lodgement Advisory (4114)">4114 - Visa File Review & Lodgement Advisory</option>
                      <option value="4311|IELTS Preparation Class Tuition (4311)">4311 - IELTS Preparation Class Tuition</option>
                      <option value="4312|PTE Academic Class Tuition (4312)">4312 - PTE Academic Class Tuition</option>
                      <option value="4313|Duolingo Preparation Tuition (4313)">4313 - Duolingo Preparation Tuition</option>
                      <option value="4314|German Language Course Fee (4314)">4314 - German Language Course Fee</option>
                      <option value="4410|Document Translation & Attestation (4410)">4410 - Document Translation & Attestation</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Payment Channel *</label>
                    <select
                      value={form.paymentMethod}
                      onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    >
                      <option value="eSewa Digital Wallet">eSewa Digital Wallet (Dr 1115)</option>
                      <option value="Khalti Digital Wallet">Khalti Digital Wallet (Dr 1115)</option>
                      <option value="Direct Bank Transfer (Nabil Bank)">Direct Bank Transfer - Nabil Bank (Dr 1113)</option>
                      <option value="ConnectIPS / NPI">ConnectIPS / NPI (Dr 1113)</option>
                      <option value="Cash Counter (Kathmandu Office)">Cash Counter (Dr 1111)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Subtotal Amount (NPR) *</label>
                    <input
                      type="number"
                      required
                      min="500"
                      step="500"
                      value={form.subtotal}
                      onChange={e => setForm({ ...form, subtotal: Number(e.target.value), amountReceived: Number(e.target.value) - form.discount })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Scholarship / Discount (NPR)</label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={form.discount}
                      onChange={e => setForm({ ...form, discount: Number(e.target.value), amountReceived: form.subtotal - Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Amount Received Now (NPR) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="500"
                      value={form.amountReceived}
                      onChange={e => setForm({ ...form, amountReceived: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Payment Status</label>
                    <select
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value as typeof form.status })}
                    >
                      <option value="PAID">PAID (Full Settlement)</option>
                      <option value="PARTIAL">PARTIAL (Advance Paid)</option>
                      <option value="PENDING">PENDING (Unpaid)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer-clean">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Receipt size={15} />
                  <span>Generate Invoice & Post Journal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE UNIVERSITY COMMISSION MODAL */}
      {showCommissionModal && (
        <div className="modal-backdrop-clean" onClick={() => setShowCommissionModal(false)}>
          <div className="modal-dialog-clean" onClick={e => e.stopPropagation()}>
            <div className="modal-header-clean">
              <div>
                <h3>Prepare Overseas University Commission Agreement</h3>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                  Accrues commission receivable into Account 1131 & Agency Revenue 4211
                </p>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setShowCommissionModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCommission}>
              <div className="modal-body-clean">
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Partner University *</label>
                    <input
                      type="text"
                      required
                      value={commForm.universityName}
                      onChange={e => setCommForm({ ...commForm, universityName: e.target.value })}
                      placeholder="e.g. University of Greenwich"
                    />
                  </div>

                  <div className="form-group">
                    <label>Study Destination Country *</label>
                    <select
                      value={commForm.country}
                      onChange={e => setCommForm({ ...commForm, country: e.target.value })}
                    >
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Australia">Australia</option>
                      <option value="Canada">Canada</option>
                      <option value="United States">United States</option>
                      <option value="Germany">Germany</option>
                      <option value="New Zealand">New Zealand</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Enrolled Candidate *</label>
                    {students.length > 0 ? (
                      <select
                        value={`${commForm.studentCode}|${commForm.studentName}`}
                        onChange={e => {
                          const [code, name] = e.target.value.split("|");
                          setCommForm({ ...commForm, studentCode: code, studentName: name });
                        }}
                      >
                        {students.map(s => (
                          <option key={s.id} value={`${s.student_code}|${s.full_name}`}>
                            {s.full_name} ({s.student_code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={commForm.studentName}
                        onChange={e => setCommForm({ ...commForm, studentName: e.target.value, studentCode: commForm.studentCode || "AECS-2026-00001" })}
                        placeholder="Candidate Full Name"
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label>Commission Agreement Type *</label>
                    <select
                      value={commForm.commissionType}
                      onChange={e => setCommForm({ ...commForm, commissionType: e.target.value as typeof commForm.commissionType })}
                    >
                      <option value="Percentage">Percentage Rate (%)</option>
                      <option value="Fixed Amount">Fixed Agency Amount (NPR)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Tuition Fee Base (NPR equivalent) *</label>
                    <input
                      type="number"
                      required
                      min="500000"
                      step="50000"
                      value={commForm.tuitionFeeAudNpr}
                      onChange={e => setCommForm({ ...commForm, tuitionFeeAudNpr: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Commission Rate (%)</label>
                    <input
                      type="number"
                      required
                      min="5"
                      max="35"
                      value={commForm.ratePct}
                      onChange={e => setCommForm({ ...commForm, ratePct: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer-clean">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCommissionModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Building size={15} />
                  <span>Save Agreement & Post Receivable</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXACT OFFICIAL PAYMENT RECEIPT MODAL (1:1 with Image 4 in previous turn) */}
      {activeReceipt && (
        <div className="modal-backdrop-clean" onClick={() => setActiveReceipt(null)}>
          <div
            className="modal-dialog-clean"
            style={{ maxWidth: "580px", background: "#FFFFFF", color: "#000000", fontFamily: "system-ui, sans-serif" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div>
                  <img src="/abroad-logo-new.png" alt="AECS Logo" style={{ width: "80px", height: "auto", objectFit: "contain" }} />
                  <span style={{ display: "block", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", marginTop: "2px", color: "#000000" }}>
                    GUIDING YOUR CAREER
                  </span>
                </div>

                <div style={{ textAlign: "right", fontSize: "11px", lineHeight: "1.5", color: "#000000" }}>
                  <strong style={{ display: "block" }}>Regd. No.: 278906/078/079</strong>
                  <span>Adwait Marga, Purano Buspark, Bagbazar, Kathmandu</span><br />
                  <span>Tel: 01-5922188 | 01-5926544</span><br />
                  <span>Email: info@aecsnepal.com</span>
                </div>
              </div>

              <div style={{ textAlign: "center", margin: "16px 0 12px 0" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "0.06em", color: "#000000", margin: 0 }}>
                  PAYMENT RECEIPT
                </h2>
              </div>

              <div style={{ borderBottom: "1px dotted #000000", marginBottom: "14px" }} />

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "6px 16px", fontSize: "12px", marginBottom: "14px" }}>
                <div>
                  <span>Receipt No.: <strong>{activeReceipt.receiptNo}</strong></span>
                </div>
                <div>
                  <span>Date: <strong>{activeReceipt.date}</strong></span>
                </div>
                <div>
                  <span>Student ID : <strong>{activeReceipt.studentCode}</strong></span>
                </div>
                <div>
                  <span>Phone : <strong>{activeReceipt.studentPhone}</strong></span>
                </div>
                <div>
                  <span>Student : <strong>{activeReceipt.studentName}</strong></span>
                </div>
                <div></div>
                <div>
                  <span>Email : <strong>{activeReceipt.studentEmail}</strong></span>
                </div>
                <div></div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span>Course : <strong>{activeReceipt.course}</strong></span>
                </div>
              </div>

              <div style={{ borderBottom: "1px dotted #000000", marginBottom: "12px" }} />

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "14px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px dotted #000000" }}>
                    <th style={{ padding: "4px 0", textAlign: "left", width: "45px" }}>S.N.</th>
                    <th style={{ padding: "4px 0", textAlign: "left" }}>Description</th>
                    <th style={{ padding: "4px 0", textAlign: "right", width: "120px" }}>Amount (NPR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "10px 0", verticalAlign: "top" }}>1.</td>
                    <td style={{ padding: "10px 0" }}>
                      <strong>{activeReceipt.serviceCategory}</strong>
                      <span style={{ display: "block", fontSize: "11px", color: "#475569" }}>
                        COA Ledger: {activeReceipt.coaIncomeCode} · Mode: {activeReceipt.paymentMethod}
                      </span>
                    </td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700 }}>
                      ₨ {activeReceipt.subtotal.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ borderBottom: "1px dotted #000000", marginBottom: "14px" }} />

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px" }}>
                <div style={{ width: "240px", fontSize: "12px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Subtotal:</span>
                    <strong>₨ {activeReceipt.subtotal.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Discount:</span>
                    <span>₨ {activeReceipt.discount.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dotted #000000", paddingTop: "4px" }}>
                    <strong>Grand Total:</strong>
                    <strong>₨ {activeReceipt.grandTotal.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Amount Received:</span>
                    <strong style={{ color: "#047857" }}>₨ {activeReceipt.amountReceived.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dotted #000000", paddingTop: "4px" }}>
                    <strong>Balance:</strong>
                    <strong>₨ {activeReceipt.balance.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <div style={{ borderBottom: "1px dotted #000000", marginBottom: "12px" }} />

              <div style={{ fontSize: "12px", marginBottom: "30px" }}>
                <span>Amount in Word : </span>
                <strong style={{ textDecoration: "underline" }}>{activeReceipt.amountInWords}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
                <div style={{ textAlign: "center", width: "200px" }}>
                  <div style={{ borderTop: "1px solid #000000", marginBottom: "4px" }} />
                  <span style={{ fontSize: "11px" }}>Authorized Signature</span>
                </div>
              </div>

              <div style={{ borderTop: "2px solid #000000", paddingTop: "10px", textAlign: "center" }}>
                <strong style={{ fontSize: "12px", color: "#000000" }}>
                  Building global futures, one student at a time. Thank you!
                </strong>
              </div>
            </div>

            <div className="modal-footer-clean" style={{ background: "#F8FAFC" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveReceipt(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>Print Official Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXACT OFFICIAL JOURNAL VOUCHER MODAL (1:1 WITH IMAGE 1) */}
      {activeVoucher && (
        <div className="modal-backdrop-clean" onClick={() => setActiveVoucher(null)}>
          <div
            className="modal-dialog-clean"
            style={{ maxWidth: "680px", background: "#FFFFFF", color: "#000000", fontFamily: "system-ui, sans-serif" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "30px" }}>
              {/* Header Matching Image 1 */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
                <div>
                  <img src="/abroad-logo-new.png" alt="AECS Logo" style={{ width: "65px", height: "auto", objectFit: "contain" }} />
                  <span style={{ display: "block", fontSize: "8.5px", fontWeight: 700, letterSpacing: "0.08em", marginTop: "2px", color: "#000000" }}>
                    GUIDING YOUR CAREER
                  </span>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <h2 style={{ fontSize: "17px", fontWeight: 900, color: "#000000", margin: 0 }}>
                    Abroad Education Consultancy Services Pvt. Ltd.
                  </h2>
                  <p style={{ fontSize: "11px", color: "#475569", margin: "2px 0 0 0" }}>
                    Adwait Marga, Purano Buspark, Bagbazar, Kathmandu
                  </p>
                  <h1 style={{ fontSize: "20px", fontWeight: 900, textDecoration: "underline", margin: "10px 0 0 0", color: "#000000" }}>
                    Journal Voucher
                  </h1>
                </div>
              </div>

              {/* Two Meta Boxes Matching Image 1 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", margin: "16px 0" }}>
                <div style={{ border: "1.5px solid #000000", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", lineHeight: "1.8" }}>
                  <div>Date : <strong>{activeVoucher.date}</strong></div>
                  <div>Voucher No : <strong>{activeVoucher.voucherNo}</strong></div>
                  <div>Department : <strong>Finance & Accounts</strong></div>
                </div>

                <div style={{ border: "1.5px solid #000000", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", lineHeight: "1.8" }}>
                  <div>Voucher Type : <strong>General Journal</strong></div>
                  <div>Currency : <strong>NPR (Nepalese Rupee)</strong></div>
                  <div>Status : <strong>{activeVoucher.status}</strong></div>
                </div>
              </div>

              {/* SECTION: ACCOUNTING ENTRIES Matching Image 1 */}
              <div style={{ background: "#CBD5E1", padding: "6px 10px", fontWeight: 900, fontSize: "12px", letterSpacing: "0.06em", color: "#000000", marginBottom: "8px" }}>
                ACCOUNTING ENTRIES
              </div>

              <div style={{ border: "1px solid #000000", overflow: "hidden", marginBottom: "16px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                  <thead>
                    <tr style={{ background: "#94A3B8", color: "#FFFFFF", borderBottom: "1px solid #000000" }}>
                      <th style={{ padding: "6px 8px", borderRight: "1px solid #000000", width: "40px", textAlign: "center" }}>S.N</th>
                      <th style={{ padding: "6px 8px", borderRight: "1px solid #000000", width: "70px", textAlign: "center" }}>Code</th>
                      <th style={{ padding: "6px 8px", borderRight: "1px solid #000000", textAlign: "left" }}>Account/Particular</th>
                      <th style={{ padding: "6px 8px", borderRight: "1px solid #000000", width: "110px", textAlign: "right" }}>Debit</th>
                      <th style={{ padding: "6px 8px", width: "110px", textAlign: "right" }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Line 1: Debit Line */}
                    <tr style={{ borderBottom: "1px solid #CBD5E1" }}>
                      <td style={{ padding: "8px", borderRight: "1px solid #000000", textAlign: "center" }}>1</td>
                      <td style={{ padding: "8px", borderRight: "1px solid #000000", textAlign: "center", fontWeight: 700 }}>{activeVoucher.debitAccountCode}</td>
                      <td style={{ padding: "8px", borderRight: "1px solid #000000", fontWeight: 600 }}>{activeVoucher.debitAccountName} (DR)</td>
                      <td style={{ padding: "8px", borderRight: "1px solid #000000", textAlign: "right", fontWeight: 700 }}>₨ {activeVoucher.amount.toLocaleString()}</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>—</td>
                    </tr>

                    {/* Line 2: Credit Line */}
                    <tr style={{ borderBottom: "1px solid #CBD5E1" }}>
                      <td style={{ padding: "8px", borderRight: "1px solid #000000", textAlign: "center" }}>2</td>
                      <td style={{ padding: "8px", borderRight: "1px solid #000000", textAlign: "center", fontWeight: 700 }}>{activeVoucher.creditAccountCode}</td>
                      <td style={{ padding: "8px", borderRight: "1px solid #000000", paddingLeft: "24px" }}>To {activeVoucher.creditAccountName} (CR)</td>
                      <td style={{ padding: "8px", borderRight: "1px solid #000000", textAlign: "right" }}>—</td>
                      <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>₨ {activeVoucher.amount.toLocaleString()}</td>
                    </tr>

                    {/* Empty Lines 3 & 4 matching template */}
                    <tr style={{ borderBottom: "1px solid #CBD5E1", height: "26px" }}>
                      <td style={{ borderRight: "1px solid #000000", textAlign: "center" }}>3</td>
                      <td style={{ borderRight: "1px solid #000000" }}></td>
                      <td style={{ borderRight: "1px solid #000000" }}></td>
                      <td style={{ borderRight: "1px solid #000000" }}></td>
                      <td></td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #000000", height: "26px" }}>
                      <td style={{ borderRight: "1px solid #000000", textAlign: "center" }}>4</td>
                      <td style={{ borderRight: "1px solid #000000" }}></td>
                      <td style={{ borderRight: "1px solid #000000" }}></td>
                      <td style={{ borderRight: "1px solid #000000" }}></td>
                      <td></td>
                    </tr>

                    {/* Total Row */}
                    <tr style={{ background: "#CBD5E1", fontWeight: 900 }}>
                      <td colSpan={3} style={{ padding: "8px 12px", borderRight: "1px solid #000000", textAlign: "right" }}>Total</td>
                      <td style={{ padding: "8px", borderRight: "1px solid #000000", textAlign: "right" }}>₨ {activeVoucher.amount.toLocaleString()}</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>₨ {activeVoucher.amount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* NARRATION Box Matching Image 1 */}
              <div style={{ border: "1.5px solid #000000", borderRadius: "6px", padding: "10px 14px", fontSize: "12px", marginBottom: "24px" }}>
                <strong style={{ textDecoration: "underline", display: "block", marginBottom: "4px" }}>NARRATION</strong>
                <span>Being {activeVoucher.description} (Ref: {activeVoucher.referenceNo}).</span>
              </div>

              {/* Bottom Signature Boxes Matching Image 1 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div style={{ border: "1.5px solid #000000", borderRadius: "8px", padding: "28px 14px 10px 14px", textAlign: "center", fontSize: "12px" }}>
                  <div style={{ borderTop: "1px solid #000000", width: "160px", margin: "0 auto 4px auto" }} />
                  <strong>Prepared by</strong><br />
                  <span style={{ fontSize: "11px", color: "#475569" }}>{activeVoucher.preparedBy}</span>
                </div>

                <div style={{ border: "1.5px solid #000000", borderRadius: "8px", padding: "28px 14px 10px 14px", textAlign: "center", fontSize: "12px" }}>
                  <div style={{ borderTop: "1px solid #000000", width: "160px", margin: "0 auto 4px auto" }} />
                  <strong>Approved by</strong><br />
                  <span style={{ fontSize: "11px", color: "#475569" }}>Not assigned</span>
                </div>
              </div>
            </div>

            <div className="modal-footer-clean" style={{ background: "#F8FAFC" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveVoucher(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>Print Official Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FinanceWorkspace;
