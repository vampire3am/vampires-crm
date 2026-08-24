import { KeyRound, Pencil, Plus, UserCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ROLE_PERMISSIONS, type StaffRole } from "../auth/AuthProvider";
import { STAFF_MODULES, STAFF_ROLES, StaffAdminService, type StaffAdminInput, type StaffAdminRecord } from "../../services/staffAdminService";

const defaultModules = (role: StaffRole) => Object.entries(ROLE_PERMISSIONS[role]).filter(([, enabled]) => enabled).map(([key]) => key);
const emptyForm = (): StaffAdminInput => ({
  full_name: "", email: "", role: "COUNSELLOR", job_title: "", department: "",
  branch: "AECS Bagbazar Main Office", phone: "", desktop_modules: defaultModules("COUNSELLOR"),
  assigned_responsibilities: "", password: "", is_active: true,
});

export function StaffManagement() {
  const [staff, setStaff] = useState<StaffAdminRecord[]>([]);
  const [form, setForm] = useState<StaffAdminInput>(emptyForm);
  const [editing, setEditing] = useState<StaffAdminRecord | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<StaffAdminRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = async () => { try { setError(""); setStaff(await StaffAdminService.list()); } catch (e) { setError(e instanceof Error ? e.message : "Staff could not be loaded"); } };
  useEffect(() => { void load(); }, []);
  const activeCount = useMemo(() => staff.filter(member => member.is_active).length, [staff]);

  const startCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const startEdit = (member: StaffAdminRecord) => {
    setEditing(member);
    setForm({ ...member, phone: member.phone ?? "", desktop_modules: member.desktop_modules ?? defaultModules(member.role), password: "" });
    setOpen(true);
  };
  const toggleModule = (module: string) => setForm(current => ({
    ...current,
    desktop_modules: current.desktop_modules?.includes(module)
      ? current.desktop_modules.filter(item => item !== module)
      : [...(current.desktop_modules ?? []), module],
  }));
  const save = async () => {
    try {
      setBusy(true); setError(""); setSuccess("");
      if (!editing && (!form.password || form.password.length < 10)) throw new Error("Temporary password must contain at least 10 characters.");
      if (!form.desktop_modules?.length) throw new Error("Select at least one desktop module.");
      if (editing) await StaffAdminService.update(editing.id, form); else await StaffAdminService.create(form);
      setOpen(false); setSuccess(editing ? "Staff access updated." : "Staff login created successfully."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Staff could not be saved"); }
    finally { setBusy(false); }
  };
  const changePassword = async () => {
    if (!passwordTarget) return;
    try { setBusy(true); setError(""); await StaffAdminService.setPassword(passwordTarget.id, newPassword); setPasswordTarget(null); setNewPassword(""); setSuccess("Password changed successfully."); }
    catch (e) { setError(e instanceof Error ? e.message : "Password could not be changed"); }
    finally { setBusy(false); }
  };

  return <>
    {error && <div className="alert-banner error" role="alert">{error}</div>}
    {success && <div className="staff-success" role="status">{success}</div>}
    <div className="crm-panel">
      <div className="panel-header-bar">
        <div><h3>Staff Accounts & Desktop Access</h3><p>Create CRM logins, define duties, and control the modules each person sees.</p></div>
        <button type="button" className="btn-primary" onClick={startCreate}><Plus size={15}/><span>Add Staff</span></button>
      </div>
      <div className="panel-body" style={{display:"flex",gap:"12px"}}>
        <span className="status-pill">{activeCount} Active</span><span className="status-pill">{staff.length} Total Accounts</span>
      </div>
      <div className="table-wrapper"><table className="crm-table"><thead><tr><th>Staff member</th><th>Role & department</th><th>Desktop modules</th><th>Assigned responsibilities</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {staff.map(member => <tr key={member.id}>
          <td><strong>{member.full_name}</strong><small style={{display:"block",color:"var(--text-muted)"}}>{member.email}</small></td>
          <td><strong>{member.job_title}</strong><small style={{display:"block",color:"var(--text-muted)"}}>{member.role.replaceAll("_", " ")} · {member.department}</small></td>
          <td style={{maxWidth:"260px",fontSize:"11px"}}>{(member.desktop_modules ?? defaultModules(member.role)).map(key => STAFF_MODULES.find(([id]) => id === key)?.[1] ?? key).join(", ")}</td>
          <td style={{maxWidth:"300px",fontSize:"11px",whiteSpace:"pre-wrap"}}>{member.assigned_responsibilities || "Not assigned"}</td>
          <td><span className={`badge-status ${member.is_active ? "enrolled" : "visa"}`}>{member.is_active ? "Active" : "Disabled"}</span></td>
          <td><div style={{display:"flex",gap:"6px"}}><button className="btn-secondary" type="button" onClick={() => startEdit(member)}><Pencil size={13}/>Edit</button><button className="password-button" type="button" onClick={() => {setPasswordTarget(member);setNewPassword("")}}><KeyRound size={13}/>Password</button></div></td>
        </tr>)}
        {!staff.length && <tr><td colSpan={6} className="admin-empty">No staff accounts found.</td></tr>}
      </tbody></table></div>
    </div>

    {open && <div className="modal-backdrop-clean" onClick={() => setOpen(false)}><div className="staff-modal" style={{width:"min(760px,100%)"}} onClick={e => e.stopPropagation()}>
      <header><div><UserCheck size={20}/><div><h2>{editing ? "Edit staff access" : "Create staff login"}</h2><p>Identity, role, responsibilities, and visible CRM modules</p></div></div><button onClick={() => setOpen(false)}><X size={18}/></button></header>
      <div className="staff-form" style={{maxHeight:"72vh",overflow:"auto"}}>
        <div className="form-row-2"><label>Full name *<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>Work email *<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} disabled={Boolean(editing)}/></label></div>
        <div className="form-row-2"><label>Role *<select value={form.role} onChange={e=>{const role=e.target.value as StaffRole;setForm({...form,role,desktop_modules:defaultModules(role)})}}>{STAFF_ROLES.map(role=><option key={role} value={role}>{role.replaceAll("_"," ")}</option>)}</select></label><label>Job title *<input value={form.job_title} onChange={e=>setForm({...form,job_title:e.target.value})}/></label></div>
        <div className="form-row-2"><label>Department *<input value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label><label>Branch *<input value={form.branch} onChange={e=>setForm({...form,branch:e.target.value})}/></label></div>
        <div className="form-row-2"><label>Phone<input value={form.phone ?? ""} onChange={e=>setForm({...form,phone:e.target.value})}/></label>{!editing && <label>Temporary password *<input type="password" value={form.password ?? ""} minLength={10} onChange={e=>setForm({...form,password:e.target.value})}/><small>At least 10 characters; share it securely.</small></label>}</div>
        <label>Assigned responsibilities<textarea style={{display:"block",width:"100%",minHeight:"90px",marginTop:"6px",padding:"10px",border:"1px solid var(--border-subtle)",borderRadius:"8px",background:"var(--bg-input)"}} value={form.assigned_responsibilities} onChange={e=>setForm({...form,assigned_responsibilities:e.target.value})} placeholder="Example: Follow up assigned UK leads daily; maintain document checklist; submit Friday pipeline report."/></label>
        <fieldset style={{border:"1px solid var(--border-subtle)",borderRadius:"10px",padding:"14px"}}><legend style={{padding:"0 6px",fontWeight:700}}>Modules shown after login</legend><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:"10px"}}>{STAFF_MODULES.map(([key,label])=><label key={key} style={{display:"flex",alignItems:"center",gap:"7px"}}><input type="checkbox" style={{width:"auto",height:"auto",margin:0}} checked={form.desktop_modules?.includes(key)??false} onChange={()=>toggleModule(key)}/>{label}</label>)}</div></fieldset>
        {editing && <label style={{display:"flex",alignItems:"center",gap:"8px"}}><input type="checkbox" style={{width:"auto",height:"auto",margin:0}} checked={form.is_active!==false} onChange={e=>setForm({...form,is_active:e.target.checked})}/>Account active</label>}
      </div><footer><button className="btn-secondary" onClick={()=>setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={()=>void save()}>{busy?"Saving…":editing?"Save access":"Create staff login"}</button></footer>
    </div></div>}

    {passwordTarget && <div className="modal-backdrop-clean" onClick={()=>setPasswordTarget(null)}><div className="staff-modal password-modal" onClick={e=>e.stopPropagation()}><header><div><KeyRound size={20}/><div><h2>Change staff password</h2><p>{passwordTarget.full_name} · {passwordTarget.email}</p></div></div><button onClick={()=>setPasswordTarget(null)}><X size={18}/></button></header><div className="staff-form"><label>New password *<input type="password" minLength={10} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/><small>Minimum 10 characters.</small></label></div><footer><button className="btn-secondary" onClick={()=>setPasswordTarget(null)}>Cancel</button><button className="btn-primary" disabled={busy||newPassword.length<10} onClick={()=>void changePassword()}>Change password</button></footer></div></div>}
  </>;
}
