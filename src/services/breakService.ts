import { supabase } from "../lib/supabase";
import { generateUuid } from "../lib/generateUuid";

export type BreakStatus="ACTIVE"|"COMPLETED"|"CANCELLED"|"MANUALLY_ADJUSTED";
export interface BreakType {id:string;code:string;name:string;isActive:boolean;sortOrder:number}
export interface MyBreakState {
  employeeId:string;employeeCode:string;fullName:string;attendanceId:string|null;attendanceDate:string|null;
  clockIn:string|null;clockOut:string|null;breaksTaken:number;totalBreakSeconds:number;
  activeBreak:{id:string;breakTypeId:string;breakType:string;startedAt:string;remarks:string|null}|null;
  breakTypes:BreakType[];
}
export interface BreakRecord {
  id:string;employeeId:string;employeeCode:string;fullName:string;department:string;breakTypeId:string;breakType:string;
  workDate:string;startedAt:string;endedAt:string|null;actualSeconds:number|null;status:BreakStatus;source:"AUTOMATIC"|"MANUAL";remarks:string|null;
}

const requestId=()=>generateUuid();
const mapType=(row:Record<string,unknown>):BreakType=>({id:String(row.id),code:String(row.code),name:String(row.name),isActive:Boolean(row.is_active),sortOrder:Number(row.sort_order)});

export const BreakService={
  async getMyState():Promise<MyBreakState|null>{
    const{data,error}=await supabase.rpc("hr_my_break_state");if(error)throw error;if(!data)return null;
    const row=data as Record<string,unknown>;const active=row.active_break as Record<string,unknown>|null;
    return{employeeId:String(row.employee_id),employeeCode:String(row.employee_code),fullName:String(row.full_name),attendanceId:row.attendance_id?String(row.attendance_id):null,attendanceDate:row.attendance_date?String(row.attendance_date):null,clockIn:row.clock_in?String(row.clock_in):null,clockOut:row.clock_out?String(row.clock_out):null,breaksTaken:Number(row.breaks_taken??0),totalBreakSeconds:Number(row.total_break_seconds??0),activeBreak:active?{id:String(active.id),breakTypeId:String(active.break_type_id),breakType:String(active.break_type),startedAt:String(active.started_at),remarks:active.remarks?String(active.remarks):null}:null,breakTypes:Array.isArray(row.break_types)?row.break_types.map(item=>({id:String(item.id),code:String(item.code),name:String(item.name),isActive:true,sortOrder:0})):[]};
  },
  async start(typeId:string,remarks="",source:"AUTOMATIC"|"MANUAL"="MANUAL"){const{data,error}=await supabase.rpc("hr_start_break",{break_type_uuid:typeId,break_remarks:remarks||null,request_uuid:requestId(),break_source:source});if(error)throw error;return String(data)},
  async end(id:string){const{error}=await supabase.rpc("hr_end_break",{break_uuid:id,request_uuid:requestId()});if(error)throw error},
  async getTypes(includeDisabled=false){let query=supabase.from("hr_break_types").select("*").order("sort_order").order("name");if(!includeDisabled)query=query.eq("is_active",true);const{data,error}=await query;if(error)throw error;return(data??[]).map(row=>mapType(row as Record<string,unknown>))},
  async saveType(type:Partial<BreakType>&{name:string;code:string}){const{error}=await supabase.rpc("hr_save_break_type",{type_uuid:type.id??null,type_name:type.name,type_code:type.code,type_active:type.isActive??true,type_sort_order:type.sortOrder??100});if(error)throw error},
  async getRecords():Promise<BreakRecord[]>{const{data,error}=await supabase.from("hr_work_break_logs").select("*,hr_employees(employee_code,full_name,department),hr_break_types(name)").eq("record_category","EMPLOYEE_BREAK").order("started_at",{ascending:false}).limit(2000);if(error)throw error;return(data??[]).map(row=>({id:row.id,employeeId:row.employee_id,employeeCode:row.hr_employees?.employee_code??"—",fullName:row.hr_employees?.full_name??"Unknown",department:row.hr_employees?.department??"—",breakTypeId:row.break_type_id,breakType:row.hr_break_types?.name??"Unknown",workDate:row.work_date,startedAt:row.started_at,endedAt:row.ended_at,actualSeconds:row.actual_seconds==null?null:Number(row.actual_seconds),status:row.status as BreakStatus,source:row.source,remarks:row.remarks??null}))},
  async manage(id:string,action:"CANCEL"|"ADJUST"|"CLOSE",reason:string,changes?:{startedAt?:string;endedAt?:string;breakTypeId?:string;remarks?:string}){const{error}=await supabase.rpc("hr_manage_work_break",{break_uuid:id,management_action:action,reason,new_started_at:changes?.startedAt??null,new_ended_at:changes?.endedAt??null,new_break_type_id:changes?.breakTypeId??null,new_remarks:changes?.remarks??null});if(error)throw error},
};

export const formatBreakDuration=(seconds:number)=>`${Math.floor(seconds/3600)?`${Math.floor(seconds/3600)}h `:""}${Math.floor(seconds%3600/60)}m${seconds<60?` ${seconds}s`:""}`;
