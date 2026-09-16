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
  avatarUrl?: string;
  phone?: string;
  bio?: string;
}

export interface ChatAttachment {
  name: string;
  size: string;
  type: "pdf" | "image" | "doc" | "archive";
  url?: string;
  path?: string;
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
  senderAvatarUrl?: string;
  channelId?: string;
  recipientId?: string;
  content: string;
  timestamp: string;
  createdAt: string;
  taggedStudentCode?: string;
  taggedStudentName?: string;
  attachments?: ChatAttachment[];
    reactions?: MessageReaction[];
  isPinned?: boolean;
  readAt?: string;
  isReadByCurrentUser?: boolean;
  readCount?: number;
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
  uploadAttachment: async (file: File): Promise<ChatAttachment> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Sign in again before attaching a file.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Attachments must be 20 MB or smaller.");
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (!allowed.includes(file.type)) throw new Error("Use a PDF, image, Word document, or text file.");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${generateUuid()}-${safeName}`;
    const { error } = await supabase.storage.from("crm-message-attachments").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return { name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, type: file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "doc", path };
  },
  removeAttachments: async (paths: string[]): Promise<void> => {
    if (paths.length) await supabase.storage.from("crm-message-attachments").remove(paths);
  },
  attachmentUrl: async (attachment: ChatAttachment): Promise<string> => {
    if (attachment.path) {
      const { data, error } = await supabase.storage.from("crm-message-attachments").createSignedUrl(attachment.path, 120);
      if (error) throw error;
      return data.signedUrl;
    }
    if (attachment.url) return attachment.url;
    throw new Error("This older attachment does not have a stored file.");
  },
  getUnreadCount: async ():Promise<number> => {const{data,error}=await supabase.rpc("get_unread_message_count");if(error)throw error;return Number(data??0)},
  markAllRead: async ():Promise<void> => {const{error}=await supabase.rpc("mark_all_messages_read");if(error)throw error;window.dispatchEvent(new CustomEvent("aecs:message-read-state"))},
  markConversationRead: async (target:{recipientId?:string;channelId?:string}):Promise<void> => {const{error}=await supabase.rpc("mark_conversation_messages_read",{other_staff_uuid:target.recipientId??null,channel_uuid:target.channelId??null});if(error)throw error;window.dispatchEvent(new CustomEvent("aecs:message-read-state"))},
  getStaff: async ():Promise<StaffUser[]> => {const{data,error}=await supabase.from("staff_profiles").select("id,full_name,email,role,department,phone,avatar_bg,avatar_url").eq("is_active",true).order("full_name");if(error)throw error;return(data??[]).map(s=>({id:String(s.id),fullName:s.full_name?.trim()||"Staff member",email:s.email?.trim()||"",role:s.role?.trim()||"Staff",department:(s.department?.trim()||"IT & Operations")as StaffUser["department"],presence:"OFFLINE",avatarBg:s.avatar_bg||"#F97316",avatarUrl:s.avatar_url??undefined,phone:s.phone??undefined}))},
  getChannels: async ():Promise<ChatChannel[]> => {const{data,error}=await supabase.from("communication_channels").select("id,name,description,category,is_private,communication_channel_members(count)").order("name");if(error)throw error;return(data??[]).map(c=>({id:c.id,name:c.name,description:c.description??"",topic:c.description??"",category:c.category==="BROADCAST"?"Broadcast":c.category==="CASE"?"Admissions":"Department",iconName:c.category==="BROADCAST"?"Megaphone":"Users",isPrivate:c.is_private,memberCount:c.communication_channel_members?.[0]?.count??0,unreadCount:0}))},
  createStaffGroup:async(payload:{name:string;description:string;memberIds:string[]}):Promise<string>=>{const{data,error}=await supabase.rpc("create_staff_group",{payload:{name:payload.name,description:payload.description,member_ids:payload.memberIds}});if(error)throw error;return String(data)},
  getMessages: async (): Promise<ChatMessage[]> => {
    const [{data,error},{data:{user}}]=await Promise.all([
      supabase.from("communication_messages").select("*,sender:staff_profiles!communication_messages_sender_id_fkey(full_name,role,avatar_bg,avatar_url),students(student_code,full_name),communication_reactions(emoji,staff_profiles(full_name)),communication_message_reads(read_at,staff_id)").order("created_at", { ascending: false }).limit(1000),
      supabase.auth.getUser(),
    ]);
    if(error)throw error;
    return[...(data??[])].reverse().map(m=>{
      const grouped=new Map<string,string[]>();
      for(const r of m.communication_reactions??[]){grouped.set(r.emoji,[...(grouped.get(r.emoji)??[]),r.staff_profiles?.full_name??"Staff"])}
      const reads=(m.communication_message_reads??[]) as Array<{read_at:string;staff_id:string}>;
      const recipientRead=reads.find(r=>r.staff_id===m.recipient_id);
      const currentUserRead=reads.some(r=>r.staff_id===user?.id);
      return{id:m.id,senderId:m.sender_id,senderName:m.sender?.full_name??"Staff",senderRole:m.sender?.role??"Staff",senderAvatarBg:m.sender?.avatar_bg??"#F97316",senderAvatarUrl:m.sender?.avatar_url??undefined,channelId:m.channel_id??undefined,recipientId:m.recipient_id??undefined,content:m.content,createdAt:m.created_at,timestamp:new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Kathmandu",hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(m.created_at)),taggedStudentCode:m.students?.student_code,taggedStudentName:m.students?.full_name,attachments:m.attachments as ChatAttachment[],reactions:[...grouped].map(([emoji,users])=>({emoji,count:users.length,users})),isPinned:m.is_pinned,readAt:recipientRead?.read_at??reads[0]?.read_at??undefined,isReadByCurrentUser:currentUserRead,readCount:reads.length};
    });
  },

  sendMessage: async (messagePayload: Omit<ChatMessage, "id" | "timestamp" | "createdAt">): Promise<ChatMessage> => {
    const{data,error}=await supabase.rpc("send_internal_message",{payload:{recipient_id:messagePayload.recipientId??"",channel_id:messagePayload.channelId??"",content:messagePayload.content,attachments:messagePayload.attachments??[]}});if(error)throw error;return { ...messagePayload, id: String(data), createdAt: new Date().toISOString(), timestamp: "Now" };
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
    const channel=supabase.channel(channelName).on("postgres_changes",{event:"*",schema:"public",table:"communication_messages"},onUpdate).on("postgres_changes",{event:"*",schema:"public",table:"communication_message_reads"},onUpdate).on("postgres_changes",{event:"*",schema:"public",table:"communication_reactions"},onUpdate).on("postgres_changes",{event:"*",schema:"public",table:"communication_channels"},onUpdate).on("postgres_changes",{event:"*",schema:"public",table:"communication_channel_members"},onUpdate).subscribe();return()=>{void supabase.removeChannel(channel)};
  },
};
