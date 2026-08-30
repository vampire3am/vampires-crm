import { supabase } from "../lib/supabase";
import { generateUuid } from "../lib/generateUuid";

export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department: "Management" | "Counselling" | "Visa & Compliance" | "Test Preparation" | "Finance & Accounts" | "Front Desk & Intake" | "B2B & Marketing" | "IT & Operations";
  presence: "ONLINE" | "IN_MEETING" | "BUSY" | "AWAY" | "OFFLINE";
  avatarBg: string;
  phone?: string;
  bio?: string;
}

export interface ChatAttachment {
  name: string;
  size: string;
  type: "pdf" | "image" | "doc" | "archive";
  url?: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatarBg: string;
  channelId?: string;
  recipientId?: string;
  content: string;
  timestamp: string;
  taggedStudentCode?: string;
  taggedStudentName?: string;
  attachments?: ChatAttachment[];
  reactions?: MessageReaction[];
  isPinned?: boolean;
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  topic: string;
  category: "Department" | "Broadcast" | "Admissions";
  iconName: string;
  isPrivate?: boolean;
  memberCount: number;
  unreadCount?: number;
}

export const MessagingService = {
  getUnreadCount: async ():Promise<number> => {const{data,error}=await supabase.rpc("get_unread_message_count");if(error)throw error;return Number(data??0)},
  markAllRead: async ():Promise<void> => {const{error}=await supabase.rpc("mark_all_messages_read");if(error)throw error;window.dispatchEvent(new CustomEvent("aecs:message-read-state"))},
  getStaff: async ():Promise<StaffUser[]> => {const{data,error}=await supabase.from("staff_profiles").select("id,full_name,email,role,department,phone,avatar_bg").eq("is_active",true).order("full_name");if(error)throw error;return(data??[]).map(s=>({id:String(s.id),fullName:s.full_name?.trim()||"Staff member",email:s.email?.trim()||"",role:s.role?.trim()||"Staff",department:(s.department?.trim()||"IT & Operations")as StaffUser["department"],presence:"OFFLINE",avatarBg:s.avatar_bg||"#F97316",phone:s.phone??undefined}))},
  getChannels: async ():Promise<ChatChannel[]> => {const{data,error}=await supabase.from("communication_channels").select("id,name,description,category,is_private,communication_channel_members(count)").order("name");if(error)throw error;return(data??[]).map(c=>({id:c.id,name:c.name,description:c.description??"",topic:c.description??"",category:c.category==="BROADCAST"?"Broadcast":c.category==="CASE"?"Admissions":"Department",iconName:c.category==="BROADCAST"?"Megaphone":"Users",isPrivate:c.is_private,memberCount:c.communication_channel_members?.[0]?.count??0,unreadCount:0}))},
  createStaffGroup:async(payload:{name:string;description:string;memberIds:string[]}):Promise<string>=>{const{data,error}=await supabase.rpc("create_staff_group",{payload:{name:payload.name,description:payload.description,member_ids:payload.memberIds}});if(error)throw error;return String(data)},
  getMessages: async (): Promise<ChatMessage[]> => {
    const{data,error}=await supabase.from("communication_messages").select("*,sender:staff_profiles!communication_messages_sender_id_fkey(full_name,role,avatar_bg),students(student_code,full_name),communication_reactions(emoji,staff_profiles(full_name))").order("created_at");if(error)throw error;return(data??[]).map(m=>{const grouped=new Map<string,string[]>();for(const r of m.communication_reactions??[]){grouped.set(r.emoji,[...(grouped.get(r.emoji)??[]),r.staff_profiles?.full_name??"Staff"])}return{id:m.id,senderId:m.sender_id,senderName:m.sender?.full_name??"Staff",senderRole:m.sender?.role??"Staff",senderAvatarBg:m.sender?.avatar_bg??"#F97316",channelId:m.channel_id??undefined,recipientId:m.recipient_id??undefined,content:m.content,timestamp:new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),taggedStudentCode:m.students?.student_code,taggedStudentName:m.students?.full_name,attachments:m.attachments as ChatAttachment[],reactions:[...grouped].map(([emoji,users])=>({emoji,count:users.length,users})),isPinned:m.is_pinned}});
  },

  sendMessage: async (messagePayload: Omit<ChatMessage, "id" | "timestamp">): Promise<ChatMessage> => {
    const{data,error}=await supabase.rpc("send_internal_message",{payload:{recipient_id:messagePayload.recipientId??"",channel_id:messagePayload.channelId??"",content:messagePayload.content,attachments:messagePayload.attachments??[]}});if(error)throw error;const current=await MessagingService.getMessages();const created=current.find(m=>m.id===data);if(!created)throw new Error("Message was created but could not be reloaded");return created;
  },

  toggleReaction: async (messageId: string, emoji: string, currentUserName: string): Promise<ChatMessage[]> => {
    void currentUserName;const{error}=await supabase.rpc("toggle_message_reaction",{message_uuid:messageId,reaction_emoji:emoji});if(error)throw error;return MessagingService.getMessages();
  },

  togglePinMessage: async (messageId: string): Promise<ChatMessage[]> => {
    const{data:current,error:readError}=await supabase.from("communication_messages").select("is_pinned").eq("id",messageId).single();if(readError)throw readError;const{error}=await supabase.from("communication_messages").update({is_pinned:!current.is_pinned}).eq("id",messageId);if(error)throw error;return MessagingService.getMessages();
  },

  deleteMessage: async (messageId: string): Promise<ChatMessage[]> => {
    const{error}=await supabase.from("communication_messages").update({deleted_at:new Date().toISOString()}).eq("id",messageId);if(error)throw error;return MessagingService.getMessages();
  },

  subscribeToSyncEvents: (onUpdate: () => void) => {
    // React StrictMode mounts effects twice in development. A unique topic prevents
    // Supabase from returning a channel that has already reached `subscribe()` while
    // the first effect's asynchronous cleanup is still removing it.
    const channelName = `crm-communications-${generateUuid()}`;
    const channel=supabase.channel(channelName).on("postgres_changes",{event:"*",schema:"public",table:"communication_messages"},onUpdate).on("postgres_changes",{event:"*",schema:"public",table:"communication_reactions"},onUpdate).on("postgres_changes",{event:"*",schema:"public",table:"communication_channels"},onUpdate).on("postgres_changes",{event:"*",schema:"public",table:"communication_channel_members"},onUpdate).subscribe();return()=>{void supabase.removeChannel(channel)};
  },
};
