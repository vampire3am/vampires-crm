import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  FileCheck2,
  FileText,
  Folder,
  Globe,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  PlaneTakeoff,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { AECS_ORGANIZATION } from "../../config/organization";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { ScreenBreakReminder } from "../wellness/ScreenBreakReminder";
import { GlobalMessageNotifier } from "../common/GlobalMessageNotifier";
import { IncomingCallToast } from "../calling/IncomingCallToast";

const SEARCH_ITEMS = [
  { label: "Dashboard Overview", detail: "Kathmandu Hub operations snapshot", to: "/dashboard", icon: LayoutDashboard },
  { label: "Leads Management", detail: "Active intake inquiries, social campaigns & fast follow-ups", to: "/leads", icon: Zap },
  { label: "Students Directory & Pipeline", detail: "Official registered student dossiers and admissions Kanban", to: "/students", icon: Users },
  { label: "Abroad & Counselling Hub", detail: "Student guidance notes and follow-ups", to: "/counselling", icon: Globe },
  { label: "University Applications", detail: "Offers, CAS/I-20 and visa lodgements", to: "/applications", icon: PlaneTakeoff },
  { label: "B2B Partner Tracking", detail: "Recruitment agents, university partners, and aggregators", to: "/b2b", icon: Handshake },
  { label: "Classes & Test Preparation", detail: "IELTS, PTE & Language batches and student enrollments", to: "/classes", icon: GraduationCap },
  { label: "Mock Tests & Scorecards", detail: "Full simulations, diagnostic results and band evaluations", to: "/mocks", icon: Award },
  { label: "Document Verification Desk", detail: "10-point visa checklist and file status", to: "/documents", icon: FileCheck2 },
  { label: "HRMS & Staff Operations", detail: "Employee master, attendance clock-in, leaves & payroll", to: "/hrms", icon: UserCheck },
  { label: "HRMS - Payroll Register", detail: "Monthly salary disbursement, SSF & 1% TDS", to: "/hrms?tab=payroll", icon: Wallet },
  { label: "HRMS - Attendance Clock-In", detail: "Biometric and daily punch-in log", to: "/hrms?tab=attendance", icon: Clock },
  { label: "Team Messages Hub", detail: "Private staff messaging, channels & calling", to: "/messages", icon: MessageSquare },
  { label: "Email Automation & Drips", detail: "Automated student lifecycle notifications & intake auto-responders", to: "/email-automation", icon: Mail },
  { label: "50 Core Blueprint Reports", detail: "Operations, finance, and management reports", to: "/analytics", icon: BarChart3 },
  { label: "Users & RBAC Permissions", detail: "18-role security matrix and maker-checker", to: "/settings?tab=roles", icon: ShieldCheck },
  { label: "Settings & ERP Blueprint", detail: "Organization, branches, and statutory profile", to: "/settings", icon: Settings },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("abroad-theme") === "dark");
  const [hrmsOpen, setHrmsOpen] = useState(true); // Open by default as requested in screenshot
  const searchInput = useRef<HTMLInputElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { profile, permissions, signOut } = useAuth();

  // Find page title from path
  const currentTitle = useMemo(() => {
    if (location.pathname.startsWith("/dashboard")) return "Dashboard Overview";
    if (location.pathname.startsWith("/leads")) return "Leads & Intake Pipeline";
    if (location.pathname.startsWith("/students")) return "Students & Admissions Directory";
    if (location.pathname.startsWith("/counselling")) return "Abroad & Counselling Hub";
    if (location.pathname.startsWith("/applications")) return "Applications & Visa Workspace";
    if (location.pathname.startsWith("/b2b")) return "B2B Partner Tracking";
    if (location.pathname.startsWith("/classes")) return "Classes & Test Preparation";
    if (location.pathname.startsWith("/mocks") || location.pathname.startsWith("/mock-tests")) return "Mock Tests & Evaluation Suite";
    if (location.pathname.startsWith("/documents")) return "Document Desk & Compliance";
    if (location.pathname.startsWith("/hrms")) return "HRMS, Attendance & Payroll";
    if (location.pathname.startsWith("/finance")) return "Finance & Chart of Accounts";
    if (location.pathname.startsWith("/messages")) return "Team Messages & Collaboration Hub";
    if (location.pathname.startsWith("/email-automation")) return "Email Automation & Drip Campaigns";
    if (location.pathname.startsWith("/analytics")) return "Analytics & 50 Core Reports";
    if (location.pathname.startsWith("/settings")) return "System Settings & RBAC";
    return "Operations Workspace";
  }, [location.pathname]);

  const searchResults = useMemo(() => {
    return SEARCH_ITEMS.filter(item =>
      `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMobileOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("abroad-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInput.current?.focus(), 50);
  }, [searchOpen]);

  const handleNavigate = (to: string) => {
    setSearchOpen(false);
    setQuery("");
    navigate(to);
  };

  const isHrmsActive = location.pathname.startsWith("/hrms");

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-mobile-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {/* Advanced Enterprise Sidebar Matching Image 4 */}
      <aside className={`app-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/abroad-logo-new.png" alt="AECS CRM" />
          </div>
          <div className="brand-text">
            <strong>Abroad Education<br />Consultancy Services</strong>
            <span>Choose Abroad to Study Abroad</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* WORKSPACE SECTION */}
          <div className="nav-group">
            <span className="nav-section-title">WORKSPACE</span>

            <NavLink
              to="/dashboard"
              className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
            >
              <div className="sidebar-link-content">
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </div>
            </NavLink>

            {permissions.leads && (
              <NavLink
                to="/leads"
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <Zap size={16} />
                  <span>Leads</span>
                </div>
                <span className="nav-badge" style={{ background: "rgba(239, 68, 68, 0.85)" }}>0</span>
              </NavLink>
            )}

            {permissions.students && (
              <NavLink
                to="/students"
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <Users size={16} />
                  <span>Students</span>
                </div>
                <span className="nav-badge" style={{ background: "rgba(249, 115, 22, 0.85)" }}>0</span>
              </NavLink>
            )}

            {permissions.applications && (
              <NavLink
                to="/applications"
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <PlaneTakeoff size={16} />
                  <span>Applications</span>
                </div>
                <span className="nav-badge" style={{ background: "rgba(245, 158, 11, 0.8)" }}>0</span>
              </NavLink>
            )}

            {permissions.counselling && (
              <NavLink
                to="/counselling"
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <Globe size={16} />
                  <span>Abroad</span>
                </div>
              </NavLink>
            )}

            {permissions.b2b && (
              <NavLink
                to="/b2b"
                className={({ isActive }) => (isActive || location.pathname.startsWith("/b2b") ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <Handshake size={16} />
                  <span>B2B Partners</span>
                </div>
                <span className="nav-badge" style={{ background: "rgba(234, 88, 12, 0.85)" }}>0</span>
              </NavLink>
            )}

            {permissions.classes && (
              <NavLink
                to="/classes"
                className={({ isActive }) => (isActive || location.pathname.startsWith("/classes") ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <BookOpen size={16} />
                  <span>Classes</span>
                </div>
                <span className="nav-badge" style={{ background: "rgba(249, 115, 22, 0.85)" }}>0</span>
              </NavLink>
            )}

            {permissions.mocks && (
              <NavLink
                to="/mocks"
                className={({ isActive }) => (isActive || location.pathname.startsWith("/mocks") || location.pathname.startsWith("/mock-tests") ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <Award size={16} />
                  <span>Mock Tests</span>
                </div>
                <span className="nav-badge" style={{ background: "rgba(245, 158, 11, 0.85)" }}>0</span>
              </NavLink>
            )}

            {permissions.documents && (
              <NavLink
                to="/documents"
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <Folder size={16} />
                  <span>Documents</span>
                </div>
              </NavLink>
            )}

            {permissions.finance && (
              <NavLink
                to="/finance"
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <CreditCard size={16} />
                  <span>Finance</span>
                </div>
              </NavLink>
            )}

            {permissions.reports && (
              <NavLink
                to="/analytics"
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <BarChart3 size={16} />
                  <span>Reports</span>
                </div>
              </NavLink>
            )}

            {/* COLLAPSIBLE HRMS GROUP (ONLY AUTHORIZED ROLES) */}
            {permissions.hrms && (
              <div style={{ marginTop: "2px" }}>
                <button
                  type="button"
                  className={`sidebar-collapsible-btn ${isHrmsActive || hrmsOpen ? "open" : ""}`}
                  onClick={() => setHrmsOpen(v => !v)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <UserCheck size={16} />
                    <span>HRMS</span>
                  </div>
                  {hrmsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {hrmsOpen && (
                  <div className="sidebar-submenu">
                    <NavLink
                      to="/hrms?tab=staff"
                      className={({ isActive }) => (isActive && location.search.includes("tab=staff") ? "sidebar-sublink active" : "sidebar-sublink")}
                    >
                      <LayoutDashboard size={14} />
                      <span>HR Dashboard</span>
                    </NavLink>

                    <NavLink
                      to="/hrms?tab=staff"
                      className={({ isActive }) => (isActive && (location.search.includes("tab=staff") || !location.search) ? "sidebar-sublink active" : "sidebar-sublink")}
                    >
                      <Users size={14} />
                      <span>Employees</span>
                    </NavLink>

                    <NavLink
                      to="/hrms?tab=attendance"
                      className={({ isActive }) => (isActive && location.search.includes("tab=attendance") ? "sidebar-sublink active" : "sidebar-sublink")}
                    >
                      <Clock size={14} />
                      <span>Attendance</span>
                    </NavLink>

                    <NavLink
                      to="/hrms?tab=leaves"
                      className={({ isActive }) => (isActive && location.search.includes("tab=leaves") ? "sidebar-sublink active" : "sidebar-sublink")}
                    >
                      <Calendar size={14} />
                      <span>Leave</span>
                    </NavLink>

                    <NavLink
                      to="/hrms?tab=payroll"
                      className={({ isActive }) => (isActive && location.search.includes("tab=payroll") ? "sidebar-sublink active" : "sidebar-sublink")}
                    >
                      <Wallet size={14} />
                      <span>Payroll</span>
                    </NavLink>

                    <NavLink
                      to="/hrms?tab=performance"
                      className={({ isActive }) => (isActive && location.search.includes("tab=performance") ? "sidebar-sublink active" : "sidebar-sublink")}
                    >
                      <TrendingUp size={14} />
                      <span>Performance</span>
                    </NavLink>

                    <NavLink
                      to="/hrms?tab=documents"
                      className={({ isActive }) => (isActive && location.search.includes("tab=documents") ? "sidebar-sublink active" : "sidebar-sublink")}
                    >
                      <FileText size={14} />
                      <span>HR Documents</span>
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {/* MESSAGES SECTION (ALL 18 STAFF CAN COLLABORATE) */}
            <NavLink
              to="/messages"
              className={({ isActive }) => (isActive || location.pathname.startsWith("/messages") ? "sidebar-link active" : "sidebar-link")}
            >
              <div className="sidebar-link-content">
                <MessageSquare size={16} />
                <span>Messages</span>
              </div>
            </NavLink>

            {/* EMAIL AUTOMATION & DRIP ENGINE */}
            <NavLink
              to="/email-automation"
              className={({ isActive }) => (isActive || location.pathname.startsWith("/email-automation") ? "sidebar-link active" : "sidebar-link")}
            >
              <div className="sidebar-link-content">
                <Mail size={16} />
                <span>Email Automation</span>
              </div>
              <span className="sidebar-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10B981", fontSize: "10.5px", fontWeight: 700 }}>Auto</span>
            </NavLink>
          </div>

          {/* ADMINISTRATION SECTION (ONLY ADMIN / IT) */}
          {permissions.settings && (
            <div className="nav-group" style={{ marginTop: "10px" }}>
              <span className="nav-section-title">ADMINISTRATION</span>

              <NavLink
                to="/settings?tab=roles"
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <ShieldCheck size={16} />
                  <span>Users & Permissions</span>
                </div>
              </NavLink>

              <NavLink
                to="/settings"
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                <div className="sidebar-link-content">
                  <Settings size={16} />
                  <span>Settings & Staff</span>
                </div>
              </NavLink>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="hub-status">
            <span className="hub-dot" />
            <div>
              <strong style={{ fontSize: "11.5px", color: "#FFFFFF", display: "block" }}>{AECS_ORGANIZATION.officeName}</strong>
              <span style={{ fontSize: "10px", color: "#94A3B8" }}>Purano Buspark, Bagbazar · NPR</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Topbar */}
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>

            <div className="topbar-breadcrumb">
              <span className="breadcrumb-tag">AECS CRM</span>
              <span style={{ color: "var(--border-strong)" }}>/</span>
              <h1>{currentTitle}</h1>
            </div>
          </div>

          <div className="topbar-right">
            {/* Global Search Button */}
            <button
              type="button"
              className="global-search-btn"
              onClick={() => setSearchOpen(true)}
              aria-label="Search Workspace"
            >
              <Search size={15} />
              <span>Search AECS CRM…</span>
              <span className="search-kbd">Ctrl K</span>
            </button>

            {/* Quick lead capture */}
            <button
              type="button"
              className="quick-action-primary-btn"
              onClick={() => navigate("/leads", { state: { openLeadCapture: true } })}
            >
              <Plus size={15} />
              <span>New Lead</span>
            </button>

            {/* Screen Time & Wellness Break Reminder (30-min active use -> 5-min break) */}
            <ScreenBreakReminder />

            {/* Theme Switcher Toggle */}
            <button
              type="button"
              className="topbar-icon-btn"
              onClick={() => setDark(v => !v)}
              aria-label="Toggle Light/Dark Theme"
              title={dark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Notifications Popover */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="topbar-icon-btn"
                onClick={() => {
                  setNotificationsOpen(v => !v);
                  setProfileOpen(false);
                }}
                aria-label="System Notifications"
              >
                <Bell size={17} />
                <span className="badge-dot" />
              </button>

              {notificationsOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "44px",
                    width: "300px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-md)",
                    padding: "14px",
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <strong style={{ fontSize: "13px" }}>Notifications</strong>
                    <span style={{ fontSize: "11px", color: "var(--accent-blue)", cursor: "pointer" }}>Mark all read</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                    <div style={{ padding: "8px", background: "var(--bg-card-subtle)", borderRadius: "4px" }}>
                      <strong>Visa Granted: Riya Sharma</strong>
                      <p style={{ margin: "2px 0 0 0", color: "var(--text-muted)", fontSize: "11px" }}>UK Visa approved by Home Office</p>
                    </div>
                    <div style={{ padding: "8px", background: "var(--bg-card-subtle)", borderRadius: "4px" }}>
                      <strong>eSewa Payment: ₨ 25,000</strong>
                      <p style={{ margin: "2px 0 0 0", color: "var(--text-muted)", fontSize: "11px" }}>Posted to Ledger 4112</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu with Role & Job Post */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="user-profile-btn"
                onClick={() => {
                  setProfileOpen(v => !v);
                  setNotificationsOpen(false);
                }}
              >
                <div
                  className="user-avatar-sm"
                  style={{ background: profile?.avatarBg || "var(--accent-blue)" }}
                >
                  {profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : "AA"}
                </div>
                <div className="user-meta" style={{ textAlign: "left" }}>
                  <span className="user-name-text">{profile?.full_name || "AECS Administrator"}</span>
                  <span className="user-role-text" style={{ fontSize: "10.5px", color: "var(--accent-blue)", fontWeight: 600 }}>
                    {profile?.job_title || profile?.role || "ADMIN"}
                  </span>
                </div>
                <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
              </button>

              {profileOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "44px",
                    width: "280px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-md)",
                    padding: "12px",
                    zIndex: 100,
                  }}
                >
                  <div style={{ paddingBottom: "10px", marginBottom: "10px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <strong style={{ fontSize: "13.5px", color: "var(--text-main)", display: "block" }}>{profile?.full_name}</strong>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>{profile?.email}</span>
                    <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                      <span style={{ fontSize: "9.5px", padding: "2px 6px", borderRadius: "4px", background: "rgba(249, 115, 22, 0.12)", color: "var(--accent-blue)", fontWeight: 700 }}>
                        {profile?.role}
                      </span>
                      <span style={{ fontSize: "9.5px", padding: "2px 6px", borderRadius: "4px", background: "var(--bg-card-subtle)", color: "var(--text-muted)" }}>
                        {profile?.department || "Kathmandu Hub"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{ width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", fontSize: "12px", color: "var(--text-main)", cursor: "pointer", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px" }}
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/messages");
                    }}
                  >
                    <MessageSquare size={13} style={{ color: "var(--accent-blue)" }} />
                    <span>My Private Messages</span>
                  </button>

                  {permissions.settings && (
                    <button
                      type="button"
                      style={{ width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", fontSize: "12px", color: "var(--text-main)", cursor: "pointer", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px" }}
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/settings");
                      }}
                    >
                      <Settings size={13} style={{ color: "var(--text-muted)" }} />
                      <span>Security & Settings</span>
                    </button>
                  )}

                  <button
                    type="button"
                    style={{ width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", fontSize: "12px", color: "var(--danger)", cursor: "pointer", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                    }}
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Global Search Dialog */}
        {searchOpen && (
          <div className="modal-backdrop-clean" onClick={() => setSearchOpen(false)}>
            <div
              className="modal-dialog-clean"
              style={{ maxWidth: "560px", top: "10%" }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "10px" }}>
                <Search size={18} style={{ color: "var(--text-muted)" }} />
                <input
                  ref={searchInput}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Type a command or search students, ledgers, reports…"
                  style={{ flex: 1, border: "none", background: "none", fontSize: "14px", color: "var(--text-main)", outline: "none" }}
                />
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setSearchOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ maxHeight: "340px", overflowY: "auto", padding: "8px" }}>
                {searchResults.map(item => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.label + item.to}
                      onClick={() => handleNavigate(item.to)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                        transition: "background 0.1s ease",
                      }}
                      className="search-result-item"
                    >
                      <div style={{ padding: "6px", borderRadius: "4px", background: "var(--bg-card-subtle)" }}>
                        <ItemIcon size={16} style={{ color: "var(--accent-blue)" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: "12.5px", display: "block", color: "var(--text-main)" }}>{item.label}</strong>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.detail}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Global Message Pop-up Toast & Audio Notifier */}
        <GlobalMessageNotifier />

        {/* Global WebRTC Incoming Call Overlay */}
        <IncomingCallToast />

        {/* Dynamic Route Content */}
        <main id="main-content" className="app-content" style={{ flex: 1 }} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppShell;
