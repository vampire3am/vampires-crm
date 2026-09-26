import{Clock,Coffee,Play,Square}from"lucide-react";
import{useCallback,useEffect,useState}from"react";
import{BreakService,formatBreakDuration,type MyBreakState}from"../../services/breakService";
import{notifyError,notifySuccess}from"../../components/common/CrmNotifications";
import{useAuth}from"../auth/AuthProvider";
import{HrmsService}from"../../services/hrmsService";

export function BreakWidget(){
 const{hasPermission}=useAuth(),[state,setState]=useState<MyBreakState|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[typeId,setTypeId]=useState(""),[tick,setTick]=useState(0);
 const allowed=hasPermission("breaks.use");
 const load=useCallback(async()=>{if(!allowed)return;try{const next=await BreakService.getMyState();setState(next);setTypeId(current=>next?.breakTypes.some(type=>type.id===current)?current:next?.breakTypes[0]?.id||"")}catch(error){notifyError("Break status unavailable",error instanceof Error?error.message:"Unable to load your break status")}finally{setLoading(false)}},[allowed]);
 // Fetch status on mount, on focus, and periodically so another device cannot leave this view stale.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{if(!allowed)return;void load();const timer=window.setInterval(()=>setTick(Date.now()),1000),poll=window.setInterval(()=>void load(),30000);const refresh=()=>void load();window.addEventListener("focus",refresh);window.addEventListener("hrms-attendance-changed",refresh);return()=>{window.clearInterval(timer);window.clearInterval(poll);window.removeEventListener("focus",refresh);window.removeEventListener("hrms-attendance-changed",refresh)}},[allowed,load]);
 const activeSeconds=state?.activeBreak&&tick?Math.max(0,Math.floor((tick-new Date(state.activeBreak.startedAt).getTime())/1000)):0;
 if(!allowed)return null;
 const canStart=Boolean(state?.clockIn&&!state.clockOut&&!state.activeBreak);
 const clockIn=async()=>{setBusy(true);try{await HrmsService.clockIn();await load();notifySuccess("Clocked in","Choose a break type when you are ready to take a break.")}catch(error){notifyError("Clock in failed",error instanceof Error?error.message:"Unable to start your workday")}finally{setBusy(false)}};
 const start=async()=>{if(!typeId)return;setBusy(true);try{await BreakService.start(typeId);await load();notifySuccess("Break started","Your start time was recorded by the server.")}catch(error){notifyError("Break not started",error instanceof Error?error.message:"Unable to start the break")}finally{setBusy(false)}};
 const end=async()=>{if(!state?.activeBreak)return;setBusy(true);try{await BreakService.end(state.activeBreak.id);await load();notifySuccess("Welcome back","Your return time and break duration were recorded.")}catch(error){notifyError("Break not ended",error instanceof Error?error.message:"Unable to end the break")}finally{setBusy(false)}};
 return <section className={`break-widget ${state?.activeBreak?"on-break":state?.clockIn&&!state.clockOut?"working":"off-work"}`} aria-label="My break today">
  <div className="break-widget-icon"><Coffee size={21}/></div><div className="break-widget-copy"><span>My Break Today</span><strong>{loading?"Checking status…":state?.activeBreak?"Currently On Break":state?.clockIn&&!state.clockOut?"Working":"Not Working"}</strong>
  <small>{state?.activeBreak?`${state.activeBreak.breakType} · started ${new Date(state.activeBreak.startedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kathmandu"})} · ${formatBreakDuration(activeSeconds)}`:!state?.clockIn?"Clock in first, then choose the kind of employee break you need.":state.clockOut?"Today's shift has ended. Breaks will be available after your next clock-in.":`Breaks taken: ${state.breaksTaken??0} · Total: ${formatBreakDuration(state.totalBreakSeconds??0)}`}</small></div>
  <div className="break-widget-actions">{state?.activeBreak?<button type="button" className="btn-primary" disabled={busy} onClick={()=>void end()}><Square size={14}/>End Break / Back to Work</button>:!state?.clockIn?<><select aria-label="Break type" disabled value={typeId} onChange={event=>setTypeId(event.target.value)}>{state?.breakTypes.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select><button type="button" className="btn-secondary" disabled={loading||busy} onClick={()=>void clockIn()}><Clock size={14}/>Clock In to Enable Breaks</button></>:state.clockOut?<><select aria-label="Break type" disabled value={typeId}>{state.breakTypes.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select><button type="button" className="btn-primary" disabled><Play size={14}/>Shift Ended</button></>:<><select aria-label="Break type" disabled={busy} value={typeId} onChange={event=>setTypeId(event.target.value)}>{state.breakTypes.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select><button type="button" className="btn-primary" disabled={!canStart||busy||!typeId} onClick={()=>void start()}><Play size={14}/>Take Break</button></>}</div>
 </section>;
}
