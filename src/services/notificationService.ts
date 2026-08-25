import { supabase } from "../lib/supabase";

export type StaffNotification={id:string;type:string;title:string;body:string;actionUrl:string|null;readAt:string|null;createdAt:string};
const map=(row:any):StaffNotification=>({id:row.id,type:row.type,title:row.title,body:row.body,actionUrl:row.action_url,readAt:row.read_at,createdAt:row.created_at});

export const NotificationService={
 async list(){const{data,error}=await supabase.from("staff_notifications").select("*").order("created_at",{ascending:false}).limit(60);if(error)throw error;return(data??[]).map(map)},
 async markRead(id:string){const{error}=await supabase.from("staff_notifications").update({read_at:new Date().toISOString()}).eq("id",id);if(error)throw error},
 async markAllRead(){const{error}=await supabase.from("staff_notifications").update({read_at:new Date().toISOString()}).is("read_at",null);if(error)throw error},
 subscribe(staffId:string,onChange:()=>void){const channel=supabase.channel(`staff-notifications-${staffId}`).on("postgres_changes",{event:"*",schema:"public",table:"staff_notifications",filter:`staff_id=eq.${staffId}`},onChange).subscribe();return()=>{void supabase.removeChannel(channel)}},
};
