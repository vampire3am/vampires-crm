import { Fragment, useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Globe2,
  Lock,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
} from "lucide-react";
import { MAKER_CHECKER_RULES, SENSITIVE_PERMISSIONS } from "../../lib/blueprintRolesData";
import { AdminService, type LiveRoleMatrix, type OrganizationForm } from "../../services/adminService";
import { StaffManagement } from "./StaffManagement";
import { AECS_ORGANIZATION } from "../../config/organization";
import { HrmsService } from "../../services/hrmsService";
import { notifySuccess } from "../../components/common/CrmNotifications";

interface LeavePolicyForm {
  leaveType: string;
  monthlyCredit: number;
  isPaid: boolean;
  allowHalfDay: boolean;
  monthlyCarryForward: boolean;
  yearEndAction: "RESET" | "CARRY_FORWARD";
  maxYearEndCarry: number | null;
  medicalDocumentAfterDays: number | null;
}

export function AdminDashboard() {
  const initialTab = new URLSearchParams(location.search).get("tab");
  const [activeTab, setActiveTab] = useState<"org" | "branches" | "staff" | "roles" | "hrms" | "security">(initialTab === "roles" ? "roles" : initialTab === "staff" ? "staff" : initialTab === "hrms" ? "hrms" : "org");
  const [roleSearch, setRoleSearch] = useState<string>("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [liveCounts, setLiveCounts] = useState({branches:0,roles:0,audits:0,staff:0});
  const [roleMatrix,setRoleMatrix]=useState<LiveRoleMatrix[]>([]);
  const [expandedRole,setExpandedRole]=useState<string | null>(null);
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicyForm[]>([]);

  // Form State
  const [orgForm, setOrgForm] = useState<OrganizationForm>({
    legalName: AECS_ORGANIZATION.legalName,
    tagline: AECS_ORGANIZATION.tagline,
    regNo: "",
    panVat: "",
    timezone: "Asia/Kathmandu (UTC+05:45)",
    fiscalYear: "FY 2082/2083 (2026/2027)",
    currency: "NPR (Nepalese Rupee · ₨)",
    address: AECS_ORGANIZATION.address,
    phone: "",
    email: "",
  });

  useEffect(()=>{Promise.all([AdminService.getOrganization(),AdminService.getCounts(),HrmsService.getLeavePolicies(),AdminService.getRoleMatrix()]).then(([organization,counts,policies,matrix])=>{if(organization)setOrgForm(organization);setLiveCounts(counts);setLeavePolicies(policies as LeavePolicyForm[]);setRoleMatrix(matrix)}).catch(error=>setSaveError(error instanceof Error?error.message:"Administration data could not be loaded"))},[]);

  const handleSaveSettings = async () => {
    try{
      setSaveError("");
      if(activeTab==="hrms"){
        await Promise.all(leavePolicies.map(policy=>HrmsService.saveLeavePolicy({leave_type:policy.leaveType,monthly_credit:policy.monthlyCredit,allow_half_day:policy.allowHalfDay,monthly_carry_forward:policy.monthlyCarryForward,year_end_action:policy.yearEndAction,max_year_end_carry:policy.maxYearEndCarry,medical_document_after_days:policy.medicalDocumentAfterDays})));
        notifySuccess("HRMS company rules saved","Monthly accrual, half-day and year-end carry-forward controls are now active.");
      }else await AdminService.saveOrganization(orgForm);
      setSavedSuccess(true);setTimeout(() => setSavedSuccess(false), 3000)
    }catch(error){setSaveError(error instanceof Error?error.message:"Settings could not be saved")}
  };

  const filteredRoles = roleMatrix.filter(item=>`${item.role} ${item.permissions.join(" ")}`.toLowerCase().includes(roleSearch.toLowerCase()));
  const roleName=(role:string)=>role.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());
  const permissionName=(permission:string)=>permission.split(".").at(-1)?.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase())??permission;
  const permissionGroups=(permissions:string[])=>Object.entries(permissions.reduce<Record<string,string[]>>((groups,permission)=>{const module=permission.split(".")[0];(groups[module]??=[]).push(permission);return groups},{})).sort(([left],[right])=>left.localeCompare(right));

  return (
    <div className="page-container">
      {saveError&&<div className="alert-banner error" role="alert"><AlertTriangle size={16}/>{saveError}</div>}
      {/* Header Row */}
      <div className="page-header-row">
        <div className="page-header-titles">
          <h2>System Settings & Enterprise Governance</h2>
          <p>
            Organization parameters, the Bagbazar office, live staff access roles, and maker-checker segregation rules.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveSettings}
          >
            {savedSuccess ? <Check size={15} /> : <Save size={15} />}
            <span>{savedSuccess ? "Configuration Saved!" : "Save Settings"}</span>
          </button>
        </div>
      </div>

      {/* Flagship Metric Strip */}
      <div className="metrics-grid-4">
        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Operating Office</span>
            <div className="metric-icon-wrap blue">
              <Building2 size={17} />
            </div>
          </div>
          <div className="metric-value">Bagbazar</div>
          <span className="metric-sub">One official AECS office</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Configured RBAC Roles</span>
            <div className="metric-icon-wrap purple">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="metric-value">{liveCounts.roles} Roles</div>
          <span className="metric-sub">Roles with configured permissions</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Active Staff</span>
            <div className="metric-icon-wrap amber">
              <CreditCard size={17} />
            </div>
          </div>
          <div className="metric-value">{liveCounts.staff} Staff</div>
          <span className="metric-sub">Current active staff profiles</span>
        </div>

        <div className="metric-box">
          <div className="metric-header">
            <span className="metric-label">Governance & Audit</span>
            <div className="metric-icon-wrap green">
              <Lock size={17} />
            </div>
          </div>
          <div className="metric-value">{liveCounts.audits.toLocaleString()} Events</div>
          <span className="metric-sub">Recorded governance audit events</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="document-tabs">
        <button
          className={activeTab === "org" ? "active" : ""}
          onClick={() => setActiveTab("org")}
        >
          <Building2 size={16} />
          <span>Organization & Legal Profile</span>
        </button>
        <button
          className={activeTab === "branches" ? "active" : ""}
          onClick={() => setActiveTab("branches")}
        >
          <Globe2 size={16} />
          <span>Bagbazar Office & Cost Centre</span>
        </button>
        <button
          className={activeTab === "staff" ? "active" : ""}
          onClick={() => setActiveTab("staff")}
        >
          <UserPlus size={16} />
          <span>Staff Accounts & Access</span>
        </button>
        <button
          className={activeTab === "roles" ? "active" : ""}
          onClick={() => setActiveTab("roles")}
        >
          <ShieldCheck size={16} />
          <span>CRM Roles & Permissions</span>
        </button>
        <button
          className={activeTab === "hrms" ? "active" : ""}
          onClick={() => setActiveTab("hrms")}
        >
          <SlidersHorizontal size={16} />
          <span>HRMS Company Rules</span>
        </button>
        <button
          className={activeTab === "security" ? "active" : ""}
          onClick={() => setActiveTab("security")}
        >
          <Lock size={16} />
          <span>Maker-Checker & Audit Rules</span>
        </button>
      </div>

      {activeTab === "staff" && <StaffManagement />}

      {activeTab === "hrms" && (
        <div className="crm-panel hrms-settings-panel">
          <div className="panel-header-bar">
            <div><h3>Leave Accrual & Carry-Forward Rules</h3><p>AECS company policy · BS-first dates · Employee → HR decision</p></div>
            <span className="status-pill">HR approval only</span>
          </div>
          <div className="hrms-policy-settings-grid">
            {leavePolicies.map((policy,index)=><article className="hrms-policy-editor" key={policy.leaveType}>
              <header><div><strong>{policy.leaveType}</strong><span>{policy.isPaid?"Paid monthly entitlement":"No entitlement balance"}</span></div><span className={`badge-status ${policy.isPaid?"enrolled":"application"}`}>{policy.isPaid?`${policy.monthlyCredit}/month`:"Approval based"}</span></header>
              <div className="form-row-2">
                <div className="form-group"><label>Monthly credit (days)</label><input type="number" min="0" step="0.5" disabled={!policy.isPaid} value={policy.monthlyCredit} onChange={event=>setLeavePolicies(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,monthlyCredit:Number(event.target.value)}:item))}/></div>
                <div className="form-group"><label>Year-end action</label><select disabled={!policy.isPaid} value={policy.yearEndAction} onChange={event=>setLeavePolicies(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,yearEndAction:event.target.value as LeavePolicyForm["yearEndAction"]}:item))}><option value="RESET">Reset</option><option value="CARRY_FORWARD">Carry forward</option></select></div>
              </div>
              <div className="form-row-2">
                <div className="form-group"><label>Maximum year-end carry</label><input type="number" min="0" step="0.5" disabled={!policy.isPaid||policy.yearEndAction!=="CARRY_FORWARD"} value={policy.maxYearEndCarry??0} onChange={event=>setLeavePolicies(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,maxYearEndCarry:Number(event.target.value)}:item))}/></div>
                <label className="hrms-policy-check"><input type="checkbox" checked={policy.allowHalfDay} onChange={event=>setLeavePolicies(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,allowHalfDay:event.target.checked}:item))}/><span>Allow half-day requests</span></label>
              </div>
              <footer>{policy.isPaid?"Closing balance automatically becomes next month’s opening balance.":"Approved unpaid leave updates attendance and becomes a payroll deduction input."}</footer>
            </article>)}
          </div>
        </div>
      )}

      {/* TAB 1: ORGANIZATION & BRANDING */}
      {activeTab === "org" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="crm-panel">
            <div className="panel-header-bar">
              <div>
                <h3>Company Legal Entity & Statutory Profile</h3>
                <p>Official registration parameters and tax identifiers in Nepal</p>
              </div>
              <span className="status-pill">Active Registration</span>
            </div>

            <div className="panel-body">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Company Legal Name *</label>
                  <input
                    type="text"
                    value={orgForm.legalName}
                    onChange={e => setOrgForm({ ...orgForm, legalName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Company Brand Tagline</label>
                  <input
                    type="text"
                    value={orgForm.tagline}
                    onChange={e => setOrgForm({ ...orgForm, tagline: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2" style={{ marginTop: "14px" }}>
                <div className="form-group">
                  <label>Company Registration No. (OCR Nepal) *</label>
                  <input
                    type="text"
                    value={orgForm.regNo}
                    onChange={e => setOrgForm({ ...orgForm, regNo: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Permanent Account Number (PAN / VAT) *</label>
                  <input
                    type="text"
                    value={orgForm.panVat}
                    onChange={e => setOrgForm({ ...orgForm, panVat: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2" style={{ marginTop: "14px" }}>
                <div className="form-group">
                  <label>Operating Jurisdiction & Timezone *</label>
                  <input
                    type="text"
                    value={orgForm.timezone}
                    onChange={e => setOrgForm({ ...orgForm, timezone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Current Fiscal Year (Nepal Standard) *</label>
                  <input
                    type="text"
                    value={orgForm.fiscalYear}
                    onChange={e => setOrgForm({ ...orgForm, fiscalYear: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2" style={{ marginTop: "14px" }}>
                <div className="form-group">
                  <label>Base Operating Currency *</label>
                  <input
                    type="text"
                    value={orgForm.currency}
                    onChange={e => setOrgForm({ ...orgForm, currency: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Headquarters Address *</label>
                  <input
                    type="text"
                    value={orgForm.address}
                    onChange={e => setOrgForm({ ...orgForm, address: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BRANCHES & COST CENTRES */}
      {activeTab === "branches" && (
        <div className="crm-panel">
          <div className="panel-header-bar">
            <div>
              <h3>AECS Bagbazar Office</h3>
              <p>The CRM operates from one official office and one cost centre.</p>
            </div>
            <span className="status-pill">1 Active Office</span>
          </div>

          <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
            <div style={{ padding: "18px", borderRadius: "var(--radius-sm)", background: "var(--bg-card-subtle)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span className="account-code-cell">BRANCH-KTM-01</span>
                <span className="badge-status enrolled">Primary Main Hub</span>
              </div>
              <strong style={{ fontSize: "15px", color: "var(--text-main)", display: "block" }}>{AECS_ORGANIZATION.officeName}</strong>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>
                {AECS_ORGANIZATION.address}
              </span>

              <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: "14px", paddingTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Branch Manager:</span>
                  <strong>Not assigned</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Active Staff:</span>
                  <strong>{liveCounts.staff} Officers</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Contact Desk:</span>
                  <span>Configure in Organization Profile</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Cost Centre:</span>
                  <span className="code-font">CC-100-KTM</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Live CRM roles and permissions */}
      {activeTab === "roles" && (
        <div className="crm-panel">
          <div className="filter-toolbar">
            <div className="search-input-wrap" style={{ width: "360px" }}>
              <Search size={16} />
              <input
                type="text"
                value={roleSearch}
                onChange={e => setRoleSearch(e.target.value)}
                placeholder="Search by role title, code, or permission scope…"
              />
            </div>
            <span className="status-pill">{roleMatrix.length} Active Role Templates</span>
          </div>

          <div className="table-wrapper role-directory-wrap">
            <table className="crm-table role-directory-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Access coverage</th>
                  <th>Effective actions</th>
                  <th aria-label="Role actions" />
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map(role => {const groups=permissionGroups(role.permissions);const expanded=expandedRole===role.role;return <Fragment key={role.role}>
                  <tr className={expanded?"role-directory-row expanded":"role-directory-row"}>
                    <td><div className="role-identity"><span>{roleName(role.role).slice(0,2).toUpperCase()}</span><div><strong>{roleName(role.role)}</strong><small>{role.role}</small></div></div></td>
                    <td><div className="role-module-summary">{groups.slice(0,4).map(([module,actions])=><span key={module}>{roleName(module)} <b>{actions.length}</b></span>)}{groups.length>4&&<span className="more">+{groups.length-4} modules</span>}</div></td>
                    <td><div className="role-action-count"><strong>{role.permissions.length}</strong><span>enabled permissions across {groups.length} modules</span></div></td>
                    <td><button type="button" className="role-expand-button" onClick={()=>setExpandedRole(expanded?null:role.role)} aria-expanded={expanded}>{expanded?<ChevronDown size={15}/>:<ChevronRight size={15}/>}<span>{expanded?"Hide permissions":"View permissions"}</span></button></td>
                  </tr>
                  {expanded&&<tr className="role-permission-detail"><td colSpan={4}><div className="role-permission-shell"><header><div><strong>{roleName(role.role)} access template</strong><span>These are the live defaults used when a staff account is assigned this role.</span></div><span>{role.permissions.length} enabled</span></header><div className="role-permission-grid">{groups.map(([module,permissions])=><section key={module}><h4>{roleName(module)} <span>{permissions.length}</span></h4>{permissions.map(permission=><div key={permission}><span className="role-permission-check"><Check size={11}/></span><div><strong>{permissionName(permission)}</strong><small>{permission}</small></div></div>)}</section>)}</div></div></td></tr>}
                </Fragment>})}
                {!filteredRoles.length&&<tr><td colSpan={4} className="admin-empty">No role templates match your search.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MAKER-CHECKER & SECURITY POLICIES */}
      {activeTab === "security" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="crm-panel">
            <div className="panel-header-bar">
              <div>
                <h3>Maker-Checker Segregation of Duties</h3>
                <p>Four-Eyes Principle governing high-risk financial and admissions actions</p>
              </div>
              <span className="status-pill">ISO 27001 Standard</span>
            </div>

            <div className="table-wrapper">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th style={{ width: "240px" }}>Workflow Action</th>
                    <th>Four-Eyes Policy / Segregation Standard</th>
                  </tr>
                </thead>
                <tbody>
                  {MAKER_CHECKER_RULES.map((rule, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong style={{ fontSize: "12.5px", color: "var(--text-main)" }}>{rule.action}</strong>
                      </td>
                      <td style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                        {rule.rule}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="crm-panel">
            <div className="panel-header-bar">
              <div>
                <h3>Sensitive Access & Audit Logging</h3>
                <p>Immutable event logging across authentication, payment deletions, and passport exports</p>
              </div>
              <span className="status-pill">Strict Audit</span>
            </div>

            <div className="table-wrapper">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th style={{ width: "200px" }}>Permission Key</th>
                    <th>Governing Security Scope</th>
                    <th>Risk Rating</th>
                    <th>Mandatory Segregation</th>
                  </tr>
                </thead>
                <tbody>
                  {SENSITIVE_PERMISSIONS.map((perm, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="account-code-cell">{perm.id}</span>
                      </td>
                      <td style={{ fontSize: "12.5px" }}>{perm.name}</td>
                      <td>
                        <span className={`badge-status ${perm.risk === "Critical" ? "visa" : perm.risk === "High" ? "new-lead" : "enrolled"}`}>
                          {perm.risk}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: perm.requiresSegregation ? "var(--success-text)" : "var(--text-muted)" }}>
                          {perm.requiresSegregation ? "Yes (Dual Auth)" : "Standard"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
