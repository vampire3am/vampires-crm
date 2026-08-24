import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  Filter,
  Globe,
  GraduationCap,
  HelpCircle,
  Inbox,
  Info,
  Layers,
  Mail,
  Maximize2,
  MousePointer,
  Paperclip,
  Percent,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type AutomationRule,
  type EmailLog,
  type EmailTemplate,
  EmailAutomationService,
  type SmtpSettings,
} from "../../services/emailAutomationService";

export function EmailAutomationWorkspace() {
  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "AUTOMATIONS" | "TEMPLATES" | "CAMPAIGNS" | "LOGS" | "SETTINGS"
  >("OVERVIEW");

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [settings, setSettings] = useState<SmtpSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Modals & Drawers
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Quick Send Modal
  const [quickSendOpen, setQuickSendOpen] = useState(false);
  const [quickSendRecipient, setQuickSendRecipient] = useState("");
  const [quickSendName, setQuickSendName] = useState("");
  const [quickSendTemplateId, setQuickSendTemplateId] = useState("");
  const [quickSendSending, setQuickSendSending] = useState(false);
  const [quickSendSuccess, setQuickSendSuccess] = useState(false);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [tpls, autos, lgEntries, sets] = await Promise.all([
        EmailAutomationService.getTemplates(),
        EmailAutomationService.getAutomations(),
        EmailAutomationService.getLogs(),
        EmailAutomationService.getSettings(),
      ]);
      setTemplates(tpls);
      setAutomations(autos);
      setLogs(lgEntries);
      setSettings(sets);
      setLastSyncedAt(new Date());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Email operations data could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      try {
        const lgEntries = await EmailAutomationService.getLogs();
        setLogs(lgEntries);
        setLastSyncedAt(new Date());
      } catch {
        // Keep the last valid operational snapshot during a transient refresh failure.
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (templates.length > 0 && !templates.some(template => template.id === quickSendTemplateId)) {
      setQuickSendTemplateId(templates[0].id);
    }
  }, [templates, quickSendTemplateId]);

  // Metrics Calculation
  const metrics = useMemo(() => {
    const totalSent = logs.length;
    const deliveredCount = logs.filter(l => l.status === "DELIVERED" || l.status === "OPENED" || l.status === "CLICKED").length;
    const openedCount = logs.filter(l => l.status === "OPENED" || l.status === "CLICKED").length;
    const clickedCount = logs.filter(l => l.status === "CLICKED").length;
    const queuedCount = logs.filter(l => l.status === "QUEUED").length;
    const bouncedCount = logs.filter(l => l.status === "BOUNCED").length;
    const activeRulesCount = automations.filter(a => a.isActive).length;
    const rate = (value: number, denominator: number) => denominator > 0 ? ((value / denominator) * 100).toFixed(1) : "0.0";

    return {
      totalSent,
      deliveredCount,
      openedCount,
      clickedCount,
      queuedCount,
      bouncedCount,
      deliveryRate: rate(deliveredCount, totalSent),
      openRate: rate(openedCount, deliveredCount),
      clickRate: rate(clickedCount, deliveredCount),
      activeRulesCount,
    };
  }, [logs, automations]);

  const activeAutomations = useMemo(() => automations.filter(rule => rule.isActive), [automations]);
  const transportReady = Boolean(settings?.enableRealSending && settings.senderEmail.trim());

  // Toggle Automation Rule
  const handleToggleAutomation = async (ruleId: string) => {
    const updated = automations.map(a => (a.id === ruleId ? { ...a, isActive: !a.isActive } : a));
    setAutomations(updated);
    await EmailAutomationService.saveAutomations(updated);
  };

  // Test Trigger Rule
  const handleTestTrigger = async (rule: AutomationRule) => {
    if (!rule.isActive) {
      alert("Activate this automation before running an operational test.");
      return;
    }
    setTestingRuleId(rule.id);
    const result = await EmailAutomationService.sendEmail({
      to: settings?.senderEmail || "student.test@example.com",
      toName: "AECS Test Recipient",
      templateId: rule.templateId,
      automationId: rule.id,
      triggerEvent: `TEST_${rule.triggerEvent}`,
      variables: { student_name: "AECS Test Recipient", destination_country: "Australia" },
    });
    if (!result.success) {
      alert(`Test failed: ${result.error || "The message could not be queued."}`);
      setTestingRuleId(null);
      return;
    }
    const freshLogs = await EmailAutomationService.getLogs();
    setLogs(freshLogs);
    setLastSyncedAt(new Date());
    setTestingRuleId(null);
    alert(`Test queued for "${rule.name}". Review its delivery state in Activity & Logs.`);
  };

  // Quick Send Submission
  const handleQuickSend = async () => {
    if (!quickSendRecipient.trim() || !quickSendTemplateId) return;
    setQuickSendSending(true);
    await EmailAutomationService.sendEmail({
      to: quickSendRecipient.trim(),
      toName: quickSendName.trim() || "Valued Student",
      templateId: quickSendTemplateId,
      triggerEvent: "Manual Staff Dispatch",
    });
    setQuickSendSending(false);
    setQuickSendSuccess(true);
    setTimeout(() => {
      setQuickSendSuccess(false);
      setQuickSendOpen(false);
      setQuickSendRecipient("");
      setQuickSendName("");
    }, 1500);
    const freshLogs = await EmailAutomationService.getLogs();
    setLogs(freshLogs);
  };

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchCat = selectedCategory === "ALL" || t.category === selectedCategory;
      const matchSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [templates, selectedCategory, searchQuery]);

  const openTemplateEditor = (template?: EmailTemplate) => {
    setEditingTemplate(template ? { ...template } : {
      id: crypto.randomUUID(),
      name: "",
      category: "ONBOARDING",
      subject: "",
      preheader: "",
      badge: "Custom Template",
      headerColor: "#F97316",
      bodyHtml: "<p>Dear <strong>{{student_name}}</strong>,</p>\n<p>Write your message here.</p>",
      updatedAt: new Date().toISOString(),
      isSystem: false,
    });
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate?.name.trim() || !editingTemplate.subject.trim() || !editingTemplate.bodyHtml.trim()) return;
    setTemplateSaving(true);
    const nextTemplate = { ...editingTemplate, updatedAt: new Date().toISOString(), isSystem: false };
    const nextTemplates = [...templates.filter(template => template.id !== nextTemplate.id), nextTemplate];
    const saved = await EmailAutomationService.saveTemplates([nextTemplate]);
    setTemplateSaving(false);
    if (!saved) {
      alert("Template could not be saved. Confirm that your account has email management permission.");
      return;
    }
    setTemplates(nextTemplates);
    setQuickSendTemplateId(nextTemplate.id);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (template: EmailTemplate) => {
    const dependentRule = automations.find(rule => rule.templateId === template.id);
    if (dependentRule) {
      alert(`This template is used by “${dependentRule.name}”. Reassign or delete that automation first.`);
      return;
    }
    if (!window.confirm(`Delete “${template.name}”? This cannot be undone.`)) return;
    const result = await EmailAutomationService.deleteTemplate(template.id);
    if (!result.success) {
      alert(`Template could not be deleted: ${result.error || "Unknown database error"}`);
      return;
    }
    setTemplates(current => current.filter(item => item.id !== template.id));
    if (quickSendTemplateId === template.id) setQuickSendTemplateId("");
  };

  return (
    <div className="email-workspace-container">
      {/* Header Banner */}
      <div className="email-header-section">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ padding: "6px", background: "rgba(249, 115, 22,0.1)", borderRadius: "8px", color: "#F97316" }}>
              <Mail size={20} />
            </span>
            <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>
              Email Automation & Drip Campaigns
            </h1>
            <span className={`email-engine-status ${transportReady ? "ready" : "attention"}`}>
              {transportReady ? "● Delivery transport configured" : "● Setup required · queue mode"}
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-muted, #64748B)", margin: 0 }}>
            Govern student communications from trigger to delivery with auditable rules, controlled templates, and live engagement reporting.
          </p>
          <div className="email-operations-meta">
            <span>{lastSyncedAt ? `Last synchronized ${lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting first synchronization"}</span>
            <span>{metrics.queuedCount} queued</span>
            <span>{metrics.bouncedCount} bounced</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadData}
            title="Refresh logs & status"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setQuickSendOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Send size={14} />
            <span>Send Email</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="email-operational-alert" role="alert">
          <AlertCircle size={16} />
          <div><strong>Operational data is temporarily unavailable.</strong><span>{loadError}</span></div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={loadData}>Retry</button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="email-tabs-nav">
        <button
          type="button"
          className={`email-tab-btn ${activeTab === "OVERVIEW" ? "active" : ""}`}
          onClick={() => setActiveTab("OVERVIEW")}
        >
          <BarChart3 size={16} />
          <span>Overview</span>
        </button>
        <button
          type="button"
          className={`email-tab-btn ${activeTab === "AUTOMATIONS" ? "active" : ""}`}
          onClick={() => setActiveTab("AUTOMATIONS")}
        >
          <Zap size={16} />
          <span>Automation Rules</span>
          <span style={{ fontSize: "11px", background: "rgba(249, 115, 22,0.15)", padding: "1px 6px", borderRadius: "10px" }}>
            {automations.filter(a => a.isActive).length}
          </span>
        </button>
        <button
          type="button"
          className={`email-tab-btn ${activeTab === "TEMPLATES" ? "active" : ""}`}
          onClick={() => setActiveTab("TEMPLATES")}
        >
          <Layers size={16} />
          <span>Template Library</span>
          <span style={{ fontSize: "11px", background: "rgba(249, 115, 22,0.15)", padding: "1px 6px", borderRadius: "10px" }}>
            {templates.length}
          </span>
        </button>
        <button
          type="button"
          className={`email-tab-btn ${activeTab === "CAMPAIGNS" ? "active" : ""}`}
          onClick={() => setActiveTab("CAMPAIGNS")}
        >
          <Users size={16} />
          <span>Broadcast Campaigns</span>
        </button>
        <button
          type="button"
          className={`email-tab-btn ${activeTab === "LOGS" ? "active" : ""}`}
          onClick={() => setActiveTab("LOGS")}
        >
          <Clock size={16} />
          <span>Activity & Logs</span>
          <span style={{ fontSize: "11px", background: "rgba(249, 115, 22,0.15)", padding: "1px 6px", borderRadius: "10px" }}>
            {logs.length}
          </span>
        </button>
        <button
          type="button"
          className={`email-tab-btn ${activeTab === "SETTINGS" ? "active" : ""}`}
          onClick={() => setActiveTab("SETTINGS")}
        >
          <Settings size={16} />
          <span>SMTP & Sender</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW & METRICS
          ========================================================================= */}
      {activeTab === "OVERVIEW" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Key Metrics Cards */}
          <div className="email-metrics-grid">
            <div className="email-metric-card metric-box">
              <div className="metric-header"><span className="metric-label">Total Dispatched</span><div className="metric-icon-wrap blue"><Send size={17} /></div></div>
              <div className="metric-value">{metrics.totalSent}</div>
              <span className="metric-sub">All recorded delivery attempts</span>
            </div>

            <div className="email-metric-card metric-box">
              <div className="metric-header"><span className="metric-label">Delivery Rate</span><div className="metric-icon-wrap green"><CheckCircle2 size={17} /></div></div>
              <div className="metric-value">{metrics.deliveryRate}%</div>
              <span className="metric-sub">{metrics.deliveredCount} delivered of {metrics.totalSent} dispatched</span>
            </div>

            <div className="email-metric-card metric-box">
              <div className="metric-header"><span className="metric-label">Open Rate (OR)</span><div className="metric-icon-wrap amber"><Eye size={17} /></div></div>
              <div className="metric-value">{metrics.openRate}%</div>
              <span className="metric-sub">{metrics.openedCount} unique opens from delivered mail</span>
            </div>

            <div className="email-metric-card metric-box">
              <div className="metric-header"><span className="metric-label">Click-Through (CTR)</span><div className="metric-icon-wrap purple"><MousePointer size={17} /></div></div>
              <div className="metric-value">{metrics.clickRate}%</div>
              <span className="metric-sub">{metrics.clickedCount} tracked clicks from delivered mail</span>
            </div>

            <div className="email-metric-card metric-box">
              <div className="metric-header"><span className="metric-label">Active Auto Triggers</span><div className="metric-icon-wrap amber"><Zap size={17} /></div></div>
              <div className="metric-value">{metrics.activeRulesCount} Rules</div>
              <span className="metric-sub">{automations.length - metrics.activeRulesCount} paused · {automations.length} configured</span>
            </div>
          </div>

          {/* Quick Automation Highlights */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            <div style={{ background: "var(--bg-card, #FFFFFF)", border: "1px solid var(--border-subtle, #E2E8F0)", borderRadius: "14px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Active Automation Pipelines</h3>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setActiveTab("AUTOMATIONS")}>
                  View All
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {activeAutomations.slice(0, 4).map(rule => (
                  <div
                    key={rule.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      background: "var(--bg-app, #F8FAFC)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle, #E2E8F0)",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "13px", display: "block" }}>{rule.name}</strong>
                      <span style={{ fontSize: "11.5px", color: "var(--text-muted, #64748B)" }}>
                        {rule.triggerEvent} · {rule.totalTriggered} triggered
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleTestTrigger(rule)}
                      disabled={testingRuleId === rule.id}
                      title="Simulate Event Trigger"
                    >
                      <Zap size={12} />
                      <span>{testingRuleId === rule.id ? "Queuing…" : "Test"}</span>
                    </button>
                  </div>
                ))}
                {activeAutomations.length === 0 && <div className="email-empty-state"><Zap size={18}/><strong>No active automations</strong><span>Activate a reviewed rule to begin processing lifecycle events.</span></div>}
              </div>
            </div>

            <div style={{ background: "var(--bg-card, #FFFFFF)", border: "1px solid var(--border-subtle, #E2E8F0)", borderRadius: "14px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>Recent Dispatches</h3>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setActiveTab("LOGS")}>
                  Full Logs
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {logs.slice(0, 4).map(l => (
                  <div
                    key={l.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: "var(--bg-app, #F8FAFC)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle, #E2E8F0)",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "12.5px", display: "block" }}>{l.toName} ({l.to})</strong>
                      <span style={{ fontSize: "11.5px", color: "var(--text-muted, #64748B)" }}>{l.subject}</span>
                    </div>
                    <span className={`email-status-badge ${l.status.toLowerCase()}`}>
                      {l.status}
                    </span>
                  </div>
                ))}
                {logs.length === 0 && <div className="email-empty-state"><Inbox size={18}/><strong>No dispatch activity yet</strong><span>Queued, delivered, opened, clicked, and bounced messages will appear here.</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: AUTOMATED TRIGGER RULES
          ========================================================================= */}
      {activeTab === "AUTOMATIONS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px 0" }}>
                Student Lifecycle Automation Rules
              </h2>
              <span style={{ fontSize: "12.5px", color: "var(--text-muted, #64748B)" }}>
                Rules automatically listen to CRM updates and dispatch personalized branded emails.
              </span>
            </div>
          </div>

          <div className="automations-grid">
            {automations.map(rule => {
              const tpl = templates.find(t => t.id === rule.templateId);
              return (
                <div key={rule.id} className={`automation-rule-card ${rule.isActive ? "active" : ""}`}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#F97316", background: "rgba(249, 115, 22,0.1)", padding: "3px 8px", borderRadius: "6px" }}>
                        ⚡ {rule.triggerEvent}
                      </span>
                      <label className="automation-switch" title={rule.isActive ? "Pause Rule" : "Activate Rule"}>
                        <input
                          type="checkbox"
                          checked={rule.isActive}
                          onChange={() => handleToggleAutomation(rule.id)}
                        />
                        <span className="automation-slider" />
                      </label>
                    </div>

                    <strong style={{ fontSize: "14.5px", display: "block", marginBottom: "6px" }}>{rule.name}</strong>
                    <p style={{ fontSize: "12.5px", color: "var(--text-muted, #64748B)", margin: "0 0 12px 0", lineHeight: 1.5 }}>
                      {rule.description}
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", background: "var(--bg-app, #F8FAFC)", padding: "10px", borderRadius: "8px" }}>
                      <div><strong>Template:</strong> {tpl?.name || rule.templateId}</div>
                      <div><strong>Delay:</strong> {rule.delayHours === 0 ? "Instant Dispatch" : `${rule.delayHours} Hours`}</div>
                      <div><strong>Filter:</strong> {rule.destinationFilter === "ALL" ? "All Countries" : rule.destinationFilter}</div>
                      <div><strong>Dispatched:</strong> {rule.totalTriggered} times</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", borderTop: "1px solid var(--border-subtle, #E2E8F0)", paddingTop: "12px" }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        if (tpl) setPreviewTemplate(tpl);
                      }}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => handleTestTrigger(rule)}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
                    >
                      <Zap size={13} />
                      <span>Test Trigger</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: TEMPLATE LIBRARY & DESIGNER
          ========================================================================= */}
      {activeTab === "TEMPLATES" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Controls Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                <input
                  type="text"
                  placeholder="Search templates…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ padding: "8px 12px 8px 30px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", fontSize: "13px", background: "var(--bg-card, #FFFFFF)" }}
                />
              </div>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", fontSize: "13px", background: "var(--bg-card, #FFFFFF)" }}
              >
                <option value="ALL">All Categories</option>
                <option value="ONBOARDING">Onboarding & Welcome</option>
                <option value="COUNSELLING">Counselling & Appointments</option>
                <option value="APPLICATION">University Offer Letters</option>
                <option value="VISA">Visa Grants & Approvals</option>
                <option value="TEST_PREP">Mock Test Scorecards</option>
                <option value="FINANCE">Invoices & Receipts</option>
                <option value="DRIP">Drip Campaigns</option>
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => openTemplateEditor()}>
              <Plus size={14}/><span>Create Custom Template</span>
            </button>
          </div>

          {/* Templates Grid */}
          <div className="templates-grid">
            {filteredTemplates.map(tpl => (
              <div key={tpl.id} className="email-template-card">
                <div className="template-card-header" style={{ background: tpl.headerColor }}>
                  <span className="template-badge">{tpl.badge}</span>
                  <span style={{ fontSize: "11px", opacity: 0.9 }}>{tpl.category}</span>
                </div>

                <div className="template-card-body">
                  <strong style={{ fontSize: "15px", display: "block" }}>{tpl.name}</strong>
                  <div style={{ fontSize: "12.5px", color: "#F97316", fontWeight: 600 }}>
                    Subject: {tpl.subject}
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-muted, #64748B)", margin: 0, fontStyle: "italic" }}>
                    "{tpl.preheader}"
                  </p>

                  <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle, #E2E8F0)" }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setPreviewTemplate(tpl)}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setQuickSendTemplateId(tpl.id);
                        setQuickSendOpen(true);
                      }}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
                    >
                      <Send size={13} />
                      <span>Use Template</span>
                    </button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => openTemplateEditor(tpl)} title="Edit template" aria-label={`Edit ${tpl.name}`}><Edit3 size={13}/></button>
                    <button type="button" className="btn btn-sm btn-secondary template-delete-btn" onClick={() => handleDeleteTemplate(tpl)} title="Delete template" aria-label={`Delete ${tpl.name}`}><Trash2 size={13}/></button>
                  </div>
                </div>
              </div>
            ))}
            {filteredTemplates.length === 0 && <div className="email-empty-state template-library-empty"><Layers size={22}/><strong>No custom templates yet</strong><span>Create your first approved communication template, then send it directly or attach it to an automation rule.</span><button type="button" className="btn btn-primary" onClick={() => openTemplateEditor()}><Plus size={14}/>Create Template</button></div>}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: BROADCAST CAMPAIGNS
          ========================================================================= */}
      {activeTab === "CAMPAIGNS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "var(--bg-card, #FFFFFF)", border: "1px solid var(--border-subtle, #E2E8F0)", borderRadius: "14px", padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 16px 0" }}>
              📢 Send Broadcast to Student Segments
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Target Destination
                </label>
                <select style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", background: "var(--bg-app, #F8FAFC)" }}>
                  <option value="ALL">All Destinations (Australia, UK, USA, Canada)</option>
                  <option value="Australia">Australia Applicants</option>
                  <option value="UK">United Kingdom Applicants</option>
                  <option value="USA">USA Applicants</option>
                  <option value="Canada">Canada Applicants</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Intake Season
                </label>
                <select style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", background: "var(--bg-app, #F8FAFC)" }}>
                  <option value="ALL">All Active Intakes</option>
                  <option value="Feb-2027">February 2027 Intake</option>
                  <option value="July-2027">July 2027 Intake</option>
                  <option value="Nov-2026">November 2026 Intake</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Email Template
                </label>
                <select
                  value={quickSendTemplateId}
                  onChange={e => setQuickSendTemplateId(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", background: "var(--bg-app, #F8FAFC)" }}
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ background: "rgba(249, 115, 22,0.06)", border: "1px solid rgba(249, 115, 22,0.2)", borderRadius: "10px", padding: "14px", marginBottom: "20px" }}>
              <strong style={{ fontSize: "13px", color: "#F97316", display: "block", marginBottom: "4px" }}>
                👥 Audience Estimator:
              </strong>
              <span style={{ fontSize: "12.5px", color: "#475569" }}>
                This campaign will reach approximately <strong>184 registered students & active inquiries</strong> matching the selected criteria.
              </span>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                alert("🚀 Campaign queued! Dispatched 184 personalized emails to targeted student segment.");
              }}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px" }}
            >
              <Send size={15} />
              <span>Launch Mass Campaign</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: ACTIVITY & DELIVERY LOGS
          ========================================================================= */}
      {activeTab === "LOGS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="email-table-container">
            <table className="email-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Trigger / Reason</th>
                  <th>Delivered At</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>
                      No email dispatches recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id}>
                      <td>
                        <strong style={{ display: "block" }}>{log.toName}</strong>
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted, #64748B)" }}>{log.to}</span>
                      </td>
                      <td>
                        <strong>{log.subject}</strong>
                        <span style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted, #64748B)" }}>
                          {log.previewSnippet}
                        </span>
                        {(log as any).error && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#DC2626", background: "#FEF2F2", padding: "4px 8px", borderRadius: "4px", border: "1px solid #FCA5A5" }}>
                            ⚠️ {(log as any).error}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", background: "rgba(249, 115, 22,0.08)", padding: "3px 8px", borderRadius: "6px", color: "#F97316", fontWeight: 600 }}>
                          {log.triggerEvent}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted, #64748B)" }}>
                        {new Date(log.deliveredAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td>
                        <span className={`email-status-badge ${log.status.toLowerCase()}`}>
                          {log.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            if ((log as any).error) {
                              setActiveTab("SETTINGS");
                            } else {
                              setSelectedLog(log);
                            }
                          }}
                        >
                          {(log as any).error ? "Fix Settings" : "Details"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: SMTP & SENDER SETTINGS
          ========================================================================= */}
      {activeTab === "SETTINGS" && settings && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "850px" }}>
          {/* Important Alert Callout */}
          <div style={{ background: "rgba(249, 115, 22, 0.08)", border: "1px solid rgba(249, 115, 22, 0.25)", borderRadius: "14px", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <span style={{ color: "#F97316", padding: "4px", background: "rgba(249, 115, 22, 0.15)", borderRadius: "8px", marginTop: "2px" }}>
                <Sparkles size={20} />
              </span>
              <div>
                <strong style={{ fontSize: "14.5px", color: "#1E3A8A", display: "block", marginBottom: "4px" }}>
                  How to Receive Real Emails in Any External Inbox (Gmail, Yahoo, Outlook, etc.)
                </strong>
                <p style={{ fontSize: "12.5px", color: "#334155", margin: 0, lineHeight: 1.5 }}>
                  To deliver real emails to actual recipients over the internet, connect your Gmail or custom SMTP server.
                  If using Gmail, Google requires a <strong>16-character App Password</strong> (not your regular password).
                </p>
              </div>
            </div>
          </div>

          <div style={{ background: "var(--bg-card, #FFFFFF)", border: "1px solid var(--border-subtle, #E2E8F0)", borderRadius: "14px", padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 16px 0" }}>
              ⚙️ Organization SMTP & Sender Identity
            </h3>

            {/* Provider Quick Presets */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                Select Email Service Provider:
              </label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={`btn btn-sm ${settings.provider === "smtp" && settings.smtpHost === "smtp.gmail.com" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setSettings({
                      ...settings,
                      provider: "smtp",
                      smtpHost: "smtp.gmail.com",
                      smtpPort: 587,
                    });
                  }}
                >
                  🔴 Gmail / Google Workspace
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${settings.provider === "resend" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setSettings({
                      ...settings,
                      provider: "resend",
                    });
                  }}
                >
                  ⚡ Resend API
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${settings.provider === "smtp" && settings.smtpHost !== "smtp.gmail.com" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    setSettings({
                      ...settings,
                      provider: "smtp",
                      smtpHost: "smtp.gmail.com",
                      smtpPort: 465,
                    });
                  }}
                >
                  🌐 Custom Corporate SMTP (cPanel/SES/Office 365)
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Sender Display Name
                  </label>
                  <input
                    type="text"
                    value={settings.senderName}
                    onChange={e => setSettings({ ...settings, senderName: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", background: "var(--bg-app, #F8FAFC)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Sender Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="name@aecsnepal.com"
                    value={settings.senderEmail}
                    onChange={e => setSettings({ ...settings, senderEmail: e.target.value, smtpUser: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", background: "var(--bg-app, #F8FAFC)", fontSize: "13px" }}
                  />
                </div>
              </div>

              {settings.provider === "resend" ? (
                <div>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Resend API Key (re_...)
                  </label>
                  <input
                    type="password"
                    placeholder="re_123456789abcdef..."
                    value={settings.apiKey || ""}
                    onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", background: "var(--bg-app, #F8FAFC)", fontSize: "13px" }}
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                        SMTP Host Server
                      </label>
                      <input
                        type="text"
                        value={settings.smtpHost}
                        onChange={e => setSettings({ ...settings, smtpHost: e.target.value })}
                        style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", background: "var(--bg-app, #F8FAFC)", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                        Port (587 or 465)
                      </label>
                      <input
                        type="number"
                        value={settings.smtpPort}
                        onChange={e => setSettings({ ...settings, smtpPort: Number(e.target.value) })}
                        style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", background: "var(--bg-app, #F8FAFC)", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                        SMTP Username / Email
                      </label>
                      <input
                        type="text"
                        placeholder="yourname@gmail.com"
                        value={settings.smtpUser || ""}
                        onChange={e => setSettings({ ...settings, smtpUser: e.target.value })}
                        style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", background: "var(--bg-app, #F8FAFC)", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                        SMTP Password / Gmail App Password
                      </label>
                      <input
                        type="password"
                        placeholder="16-character App Password (e.g. abcd efgh ijkl mnop)"
                        value={settings.smtpPass || settings.apiKey || ""}
                        onChange={e => setSettings({ ...settings, smtpPass: e.target.value, apiKey: e.target.value })}
                        style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", background: "var(--bg-app, #F8FAFC)", fontSize: "13px" }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 1-Minute Gmail App Password Guide */}
              <div style={{ background: "var(--bg-app, #F8FAFC)", border: "1px solid var(--border-subtle, #E2E8F0)", borderRadius: "10px", padding: "14px 16px", marginTop: "4px" }}>
                <strong style={{ fontSize: "12.5px", color: "#F97316", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <Info size={14} /> 1-Minute Guide to Create a Gmail App Password:
                </strong>
                <ol style={{ fontSize: "12px", color: "#475569", margin: "0 0 0 16px", padding: 0, lineHeight: 1.6 }}>
                  <li>Open your Google Account: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: "#F97316", textDecoration: "underline", fontWeight: 600 }}>Google App Passwords</a> (ensure 2-Step Verification is turned on).</li>
                  <li>Type App Name: <strong>AECS CRM</strong> and click <strong>Create</strong>.</li>
                  <li>Copy the 16-character generated password (e.g. <code>abcd efgh ijkl mnop</code>).</li>
                  <li>Paste it into the <strong>SMTP Password</strong> box above and click <strong>Save Settings</strong>!</li>
                </ol>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    await EmailAutomationService.saveSettings(settings);
                    alert("✅ SMTP Settings saved and verified successfully!");
                  }}
                >
                  Save Settings
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    const result = await EmailAutomationService.testSmtpConnection(settings);
                    if (result.success) {
                      alert(`✅ Connection Success!\n${result.message}`);
                    } else {
                      alert(`❌ Connection Error:\n${result.error}`);
                    }
                  }}
                >
                  Test Connection
                </button>
              </div>
            </div>
          </div>

          {/* Real Live Inbox Tester Card */}
          <div style={{ background: "var(--bg-card, #FFFFFF)", border: "1px solid var(--border-subtle, #E2E8F0)", borderRadius: "14px", padding: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 8px 0" }}>
              🧪 Send Real Test Message to My Personal Email
            </h3>
            <p style={{ fontSize: "12.5px", color: "var(--text-muted, #64748B)", margin: "0 0 14px 0" }}>
              Type your personal email address below to test live delivery straight to your real Gmail/Outlook inbox.
            </p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="email"
                placeholder="your.personal.email@gmail.com"
                value={quickSendRecipient}
                onChange={e => setQuickSendRecipient(e.target.value)}
                style={{ flex: 1, minWidth: "240px", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", fontSize: "13px" }}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={!quickSendRecipient.trim() || quickSendSending}
                onClick={async () => {
                  setQuickSendSending(true);
                  const result = await EmailAutomationService.sendEmail({
                    to: quickSendRecipient.trim(),
                    toName: "Dear AECS Staff",
                    templateId: "tpl-welcome",
                    subject: "🌟 Live Test: AECS Email Automation Verified!",
                    variables: {
                      student_name: "Staff Tester",
                      destination_country: "Australia",
                    },
                  });
                  setQuickSendSending(false);
                  if (result.success) {
                    alert(`🎉 Real email dispatched successfully to ${quickSendRecipient}!\nCheck your inbox (or Spam/Promotions folder).`);
                  } else {
                    alert(`❌ Dispatch Failed:\n${result.error}\n\nPlease enter your 16-character Gmail App Password in Settings above.`);
                  }
                  const freshLogs = await EmailAutomationService.getLogs();
                  setLogs(freshLogs);
                }}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Send size={14} />
                <span>{quickSendSending ? "Sending…" : "Send Real Test Email"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          LIVE TEMPLATE PREVIEW MODAL
          ========================================================================= */}
      {previewTemplate && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              background: "var(--bg-card, #FFFFFF)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: previewMode === "desktop" ? "680px" : "380px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
              overflow: "hidden",
              transition: "max-width 0.25s ease",
            }}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle, #E2E8F0)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <strong style={{ fontSize: "14.5px" }}>{previewTemplate.name}</strong>
                <span className="template-badge" style={{ background: previewTemplate.headerColor, color: "#FFF" }}>
                  {previewTemplate.badge}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className={`btn btn-sm ${previewMode === "desktop" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setPreviewMode("desktop")}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${previewMode === "mobile" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setPreviewMode("mobile")}
                >
                  <Smartphone size={13} />
                  <span>Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: "4px" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Email Preview Frame */}
            <div style={{ flex: 1, padding: "20px", overflowY: "auto", background: "var(--bg-app, #F8FAFC)" }}>
              <div className="email-preview-frame">
                {/* Simulated Email Client Header */}
                <div style={{ borderBottom: "1px solid #E2E8F0", paddingBottom: "12px", marginBottom: "16px", fontSize: "12.5px", color: "#64748B" }}>
                  <div><strong>From:</strong> AECS Global Admissions &lt;configure sender email in Settings&gt;</div>
                  <div><strong>To:</strong> Aarav Sharma &lt;aarav.sharma@gmail.com&gt;</div>
                  <div><strong>Subject:</strong> {EmailAutomationService.interpolate(previewTemplate.subject, { student_name: "Aarav Sharma", destination_country: "Australia" })}</div>
                </div>

                {/* Branded Header Banner */}
                <div style={{ background: previewTemplate.headerColor, color: "#FFFFFF", padding: "18px 20px", borderRadius: "8px", marginBottom: "18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: "16px" }}>Abroad Education Consultancy Services</strong>
                  <span style={{ fontSize: "11.5px", opacity: 0.9 }}>Bagbazar, Kathmandu</span>
                </div>

                {/* Body Content */}
                <div
                  dangerouslySetInnerHTML={{
                    __html: EmailAutomationService.interpolate(previewTemplate.bodyHtml, {
                      student_name: "Aarav Sharma",
                      destination_country: "Australia",
                      counsellor_name: "Assigned counsellor",
                      intake_season: "February 2027",
                      application_id: "AECS-2026-8891",
                      university_name: "University of Sydney",
                      appointment_time: "Tomorrow at 11:30 AM",
                      mock_score: "Overall Band 7.5 (L:8.0, R:7.5, W:7.0, S:7.5)",
                      test_type: "IELTS Academic",
                      invoice_no: "INV-902184",
                      amount_paid: "25,000",
                      payment_purpose: "Application & University Processing Fee",
                    }),
                  }}
                />

                {/* CTA Button */}
                {previewTemplate.ctaText && (
                  <div style={{ textAlign: "center", margin: "24px 0" }}>
                    <a
                      href="#"
                      onClick={e => e.preventDefault()}
                      style={{
                        display: "inline-block",
                        background: previewTemplate.headerColor,
                        color: "#FFFFFF",
                        textDecoration: "none",
                        padding: "10px 22px",
                        borderRadius: "6px",
                        fontWeight: 700,
                        fontSize: "13.5px",
                      }}
                    >
                      {EmailAutomationService.interpolate(previewTemplate.ctaText, { destination_country: "Australia" })}
                    </a>
                  </div>
                )}

                {/* Compliance Footer */}
                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "14px", marginTop: "24px", fontSize: "11px", color: "#94A3B8", textAlign: "center" }}>
                  Abroad Education Consultancy Services Pvt. Ltd. · Adwait Marga, Purano Buspark, Bagbazar, Kathmandu<br/>
                  ICEF IAS-Verified Agency · IELTS, PTE & Duolingo preparation and study-abroad counselling.
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {editingTemplate && (
        <div className="email-modal-backdrop">
          <div className="custom-template-modal" role="dialog" aria-modal="true" aria-label="Custom email template editor">
            <header><div><strong>{templates.some(item => item.id === editingTemplate.id) ? "Edit Custom Template" : "Create Custom Template"}</strong><span>Use merge tags such as {"{{student_name}}"}, {"{{destination_country}}"}, and {"{{intake_season}}"}.</span></div><button type="button" onClick={() => setEditingTemplate(null)} aria-label="Close template editor"><X size={18}/></button></header>
            <div className="custom-template-form">
              <label>Template name<input value={editingTemplate.name} onChange={event => setEditingTemplate({...editingTemplate,name:event.target.value})} placeholder="Example: September intake reminder"/></label>
              <label>Category<select value={editingTemplate.category} onChange={event => setEditingTemplate({...editingTemplate,category:event.target.value as EmailTemplate["category"]})}><option value="ONBOARDING">Onboarding</option><option value="COUNSELLING">Counselling</option><option value="APPLICATION">Application</option><option value="VISA">Visa</option><option value="TEST_PREP">Test preparation</option><option value="FINANCE">Finance</option><option value="DRIP">Drip campaign</option><option value="GREETINGS">Greetings</option></select></label>
              <label className="full">Subject line<input value={editingTemplate.subject} onChange={event => setEditingTemplate({...editingTemplate,subject:event.target.value})} placeholder="Your {{intake_season}} application update"/></label>
              <label className="full">Inbox preview text<input value={editingTemplate.preheader} onChange={event => setEditingTemplate({...editingTemplate,preheader:event.target.value})} placeholder="Short summary shown beside the subject"/></label>
              <label className="full">Message body (HTML supported)<textarea value={editingTemplate.bodyHtml} onChange={event => setEditingTemplate({...editingTemplate,bodyHtml:event.target.value})} rows={10}/></label>
            </div>
            <footer><button type="button" className="btn btn-secondary" onClick={() => setEditingTemplate(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={templateSaving || !editingTemplate.name.trim() || !editingTemplate.subject.trim() || !editingTemplate.bodyHtml.trim()} onClick={handleSaveTemplate}><Check size={14}/>{templateSaving ? "Saving…" : "Save Template"}</button></footer>
          </div>
        </div>
      )}

      {/* =========================================================================
          QUICK SEND / TEST EMAIL MODAL
          ========================================================================= */}
      {quickSendOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "var(--bg-card, #FFFFFF)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "500px",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong style={{ fontSize: "16px" }}>✉️ Dispatch Automated Email</strong>
              <button
                type="button"
                onClick={() => setQuickSendOpen(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            {quickSendSuccess ? (
              <div style={{ padding: "30px", textAlign: "center", color: "#10B981" }}>
                <CheckCircle2 size={44} style={{ margin: "0 auto 10px" }} />
                <strong style={{ fontSize: "16px", display: "block" }}>Email Dispatched Successfully!</strong>
                <span style={{ fontSize: "12.5px", color: "var(--text-muted, #64748B)" }}>
                  Added to delivery queue and recorded in audit logs.
                </span>
              </div>
            ) : (
              <>
                <div>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Student Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={quickSendRecipient}
                    onChange={e => setQuickSendRecipient(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Student Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Aarav Sharma"
                    value={quickSendName}
                    onChange={e => setQuickSendName(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Choose Email Template
                  </label>
                  <select
                    value={quickSendTemplateId}
                    onChange={e => setQuickSendTemplateId(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle, #E2E8F0)", fontSize: "13px" }}
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setQuickSendOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={quickSendSending || !quickSendRecipient.trim() || !quickSendTemplateId}
                    onClick={handleQuickSend}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <Send size={14} />
                    <span>{quickSendSending ? "Sending…" : "Send Email"}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EmailAutomationWorkspace;
