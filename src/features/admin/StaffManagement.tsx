import { Check, KeyRound, Pencil, Plus, Search, ShieldCheck, UserCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { StaffRole } from "../auth/AuthProvider";
import { STAFF_ROLES, StaffAdminService, type StaffAdminInput, type StaffAdminRecord } from "../../services/staffAdminService";
import { modulesForPermissions, STAFF_PERMISSION_GROUPS } from "./staffPermissionCatalog";

const emptyForm = (): StaffAdminInput => ({
  full_name: "", email: "", role: "COUNSELLOR", job_title: "", department: "",
  branch: "AECS Bagbazar Main Office", phone: "", desktop_modules: ["dashboard"], assigned_responsibilities: "",
  access_mode: "ROLE_PLUS", inactivity_minutes: 30, permission_overrides: [], password: "", is_active: true,
});
const roleName = (role: StaffRole) => role.replaceAll("_", " ").replace(/\b\w/g, value => value.toUpperCase());

export function StaffManagement() {
  const [staff, setStaff] = useState<StaffAdminRecord[]>([]);
  const [form, setForm] = useState<StaffAdminInput>(emptyForm);
  const [roleDefaults, setRoleDefaults] = useState<string[]>([]);
  const [editing, setEditing] = useState<StaffAdminRecord | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<StaffAdminRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => { try { setError(""); setStaff(await StaffAdminService.list()); } catch (e) { setError(e instanceof Error ? e.message : "Staff could not be loaded"); } };
  useEffect(() => {
    let active = true;
    StaffAdminService.list().then(records => { if (active) setStaff(records); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Staff could not be loaded"); });
    return () => { active = false; };
  }, []);
  const activeCount = useMemo(() => staff.filter(member => member.is_active).length, [staff]);
  const selected = useMemo(() => new Set(form.permission_overrides ?? []), [form.permission_overrides]);
  const defaults = useMemo(() => new Set(roleDefaults), [roleDefaults]);
  const effective = useMemo(() => form.access_mode === "EXACT" ? [...selected] : [...new Set([...roleDefaults, ...selected])], [form.access_mode, roleDefaults, selected]);
  const filteredGroups = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();
    if (!query) return STAFF_PERMISSION_GROUPS;
    return STAFF_PERMISSION_GROUPS.map(group => ({ ...group, permissions: group.permissions.filter(item => `${group.label} ${item.label} ${item.key}`.toLowerCase().includes(query)) })).filter(group => group.permissions.length);
  }, [permissionSearch]);

  const openWithRole = async (next: StaffAdminInput, member: StaffAdminRecord | null) => {
    setEditing(member); setForm(next); setPermissionSearch(""); setOpen(true);
    try { setRoleDefaults(await StaffAdminService.rolePermissions(next.role)); } catch { setRoleDefaults([]); }
  };
  const startCreate = () => void openWithRole(emptyForm(), null);
  const startEdit = (member: StaffAdminRecord) => void openWithRole({ ...member, phone: member.phone ?? "", permission_overrides: member.permission_overrides ?? [], password: "" }, member);
  const changeRole = async (role: StaffRole) => {
    setForm(current => ({ ...current, role, permission_overrides: current.access_mode === "ROLE_PLUS" ? [] : current.permission_overrides }));
    try { setRoleDefaults(await StaffAdminService.rolePermissions(role)); } catch { setRoleDefaults([]); }
  };
  const togglePermission = (key: string) => setForm(current => ({ ...current, permission_overrides: selected.has(key) ? [...selected].filter(item => item !== key) : [...selected, key] }));
  const setGroup = (keys: string[], checked: boolean) => setForm(current => {
    const next = new Set(current.permission_overrides ?? []);
    keys.forEach(key => checked ? next.add(key) : next.delete(key));
    return { ...current, permission_overrides: [...next] };
  });
  const save = async () => {
    try {
      setBusy(true); setError(""); setSuccess("");
      if (!form.full_name.trim() || !form.email.trim()) throw new Error("Full name and work email are required.");
      if (!editing && (!form.password || form.password.length < 10)) throw new Error("Temporary password must contain at least 10 characters.");
      if (!effective.length) throw new Error("Select at least one permission for this account.");
      const payload = { ...form, desktop_modules: modulesForPermissions(effective) };
      if (editing) await StaffAdminService.update(editing.id, payload); else await StaffAdminService.create(payload);
      setOpen(false); setSuccess(editing ? "Staff identity and access updated successfully." : "Staff login created successfully."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Staff could not be saved"); }
    finally { setBusy(false); }
  };
  const changePassword = async () => {
    if (!passwordTarget) return;
    try { setBusy(true); setError(""); await StaffAdminService.setPassword(passwordTarget.id, newPassword); setPasswordTarget(null); setNewPassword(""); setSuccess("Temporary password reset successfully."); }
    catch (e) { setError(e instanceof Error ? e.message : "Password could not be changed"); }
    finally { setBusy(false); }
  };

  return <>
    {error && <div className="alert-banner error" role="alert">{error}</div>}
    {success && <div className="staff-success" role="status">{success}</div>}
    <div className="crm-panel">
      <div className="panel-header-bar"><div><h3>Staff accounts & access control</h3><p>Manage staff identity, exact operational permissions, and account security.</p></div><button type="button" className="btn-primary" onClick={startCreate}><Plus size={15}/>Add staff</button></div>
      <div className="staff-access-summary"><span><strong>{activeCount}</strong> active accounts</span><span><strong>{staff.length}</strong> total accounts</span><span><ShieldCheck size={14}/><strong>Action-level</strong> authorization</span></div>
      <div className="table-wrapper"><table className="crm-table"><thead><tr><th>Staff member</th><th>Role & branch</th><th>Access policy</th><th>Effective access</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {staff.map(member => <tr key={member.id}><td><strong>{member.full_name}</strong><small>{member.email}</small></td><td><strong>{member.job_title}</strong><small>{roleName(member.role)} · {member.branch}</small></td><td><span className="access-mode-pill">{member.access_mode === "EXACT" ? "Exact custom" : "Role + additions"}</span><small>{member.inactivity_minutes} min inactivity sign-out</small></td><td><strong>{member.permission_overrides.length} custom</strong><small>{member.desktop_modules?.length ?? 0} workspaces available</small></td><td><span className={`badge-status ${member.is_active ? "enrolled" : "visa"}`}>{member.is_active ? "Active" : "Disabled"}</span></td><td><div className="staff-table-actions"><button className="btn-secondary" type="button" onClick={() => startEdit(member)}><Pencil size={13}/>Edit access</button><button className="password-button" type="button" onClick={() => {setPasswordTarget(member);setNewPassword("")}}><KeyRound size={13}/>Reset</button></div></td></tr>)}
        {!staff.length && <tr><td colSpan={6} className="admin-empty">No staff accounts found.</td></tr>}
      </tbody></table></div>
    </div>

    {open && <div className="modal-backdrop-clean staff-access-backdrop" onClick={() => setOpen(false)}><div className="staff-modal staff-access-modal" onClick={event => event.stopPropagation()}>
      <header><div><span className="staff-access-icon"><UserCheck size={20}/></span><div><span className="staff-access-eyebrow">Administration</span><h2>{editing ? "Edit staff account" : "Create staff account"}</h2><p>Control identity and the exact CRM workspace available to this employee.</p></div></div><button onClick={() => setOpen(false)} aria-label="Close"><X size={18}/></button></header>
      <div className="staff-access-content">
        <section className="staff-access-section"><div className="staff-section-heading"><h3>Identity & employment</h3><p>Account details used throughout HRMS, assignments and audit records.</p></div>
          <div className="staff-field-grid"><label>Full name *<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>Work email *<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} disabled={Boolean(editing)}/></label><label>Phone<input value={form.phone ?? ""} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>Job title *<input value={form.job_title} onChange={e=>setForm({...form,job_title:e.target.value})}/></label><label>Department *<input value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label><label>Branch *<input value={form.branch} onChange={e=>setForm({...form,branch:e.target.value})}/></label><label>Primary CRM role *<select value={form.role} onChange={e=>void changeRole(e.target.value as StaffRole)}>{STAFF_ROLES.map(role=><option key={role} value={role}>{roleName(role)}</option>)}</select></label><label>Sign out after inactivity<select value={form.inactivity_minutes} onChange={e=>setForm({...form,inactivity_minutes:Number(e.target.value)})}>{[5,15,30,60,120,480].map(minutes=><option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : `${minutes/60} hour${minutes===60?"":"s"}`}</option>)}</select></label>{!editing && <label>Temporary password *<input type="password" minLength={10} value={form.password ?? ""} onChange={e=>setForm({...form,password:e.target.value})}/><small>At least 10 characters.</small></label>}</div>
        </section>
        <section className="staff-access-section"><div className="staff-section-heading"><h3>Access policy</h3><p>Choose a role baseline or make every permission explicit.</p></div><div className="access-policy-grid">
          <button type="button" className={form.access_mode === "ROLE_PLUS" ? "active" : ""} onClick={()=>setForm({...form,access_mode:"ROLE_PLUS",permission_overrides:[]})}><span><Check size={14}/></span><strong>Role template + additions</strong><small>Role defaults remain active; add extra actions below.</small></button>
          <button type="button" className={form.access_mode === "EXACT" ? "active" : ""} onClick={()=>setForm({...form,access_mode:"EXACT",permission_overrides:[...new Set([...roleDefaults,...(form.permission_overrides??[])])]})}><span><Check size={14}/></span><strong>Exact custom access</strong><small>Only checked actions are visible and accessible.</small></button>
        </div></section>
        <section className="staff-access-section permission-section"><div className="permission-toolbar"><div><h3>CRM permissions</h3><p>{effective.length} effective actions · {modulesForPermissions(effective).length} workspaces</p></div><label><Search size={15}/><input value={permissionSearch} onChange={e=>setPermissionSearch(e.target.value)} placeholder="Search permissions"/></label></div>
          <div className="permission-card-grid">{filteredGroups.map(group => { const keys=group.permissions.map(item=>item.key); const editableKeys=form.access_mode === "ROLE_PLUS" ? keys.filter(key=>!defaults.has(key)) : keys; const all=editableKeys.length>0 && editableKeys.every(key=>selected.has(key)); return <article className="permission-card" key={group.id}><div className="permission-card-head"><div><h4>{group.label}</h4><small>{group.module}</small></div><button type="button" disabled={!editableKeys.length} onClick={()=>setGroup(editableKeys,!all)}>{all?"Deselect":"Select"}</button></div>{group.permissions.map(item => { const inherited=form.access_mode === "ROLE_PLUS" && defaults.has(item.key); const checked=inherited||selected.has(item.key); return <label key={item.key} className={inherited?"inherited":""}><input type="checkbox" checked={checked} disabled={inherited} onChange={()=>togglePermission(item.key)}/><span><strong>{item.label}</strong><small>{item.key}{inherited?" · role default":""}</small></span></label> })}</article> })}</div>
        </section>
        <section className="staff-access-section"><div className="staff-section-heading"><h3>Operational responsibilities</h3><p>Human-readable duties shown to managers; permissions above remain authoritative.</p></div><textarea className="responsibility-input" value={form.assigned_responsibilities} onChange={e=>setForm({...form,assigned_responsibilities:e.target.value})} placeholder="Example: Own assigned UK leads, verify student documents, and submit the Friday pipeline report."/>{editing && <label className="account-toggle"><input type="checkbox" checked={form.is_active!==false} onChange={e=>setForm({...form,is_active:e.target.checked})}/><span><strong>Account active</strong><small>Disabled accounts cannot sign in or use any CRM permission.</small></span></label>}</section>
      </div><footer><span>{effective.length} permissions ready</span><div><button className="btn-secondary" onClick={()=>setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={()=>void save()}>{busy?"Saving…":editing?"Save staff account":"Create staff account"}</button></div></footer>
    </div></div>}

    {passwordTarget && <div className="modal-backdrop-clean" onClick={()=>setPasswordTarget(null)}><div className="staff-modal password-modal" onClick={e=>e.stopPropagation()}><header><div><KeyRound size={20}/><div><h2>Reset staff access</h2><p>{passwordTarget.full_name} · {passwordTarget.email}</p></div></div><button onClick={()=>setPasswordTarget(null)}><X size={18}/></button></header><div className="staff-form"><label>Temporary password *<input type="password" minLength={10} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/><small>Minimum 10 characters. The reset is audit logged.</small></label></div><footer><button className="btn-secondary" onClick={()=>setPasswordTarget(null)}>Cancel</button><button className="btn-primary" disabled={busy||newPassword.length<10} onClick={()=>void changePassword()}>Reset password</button></footer></div></div>}
  </>;
}
