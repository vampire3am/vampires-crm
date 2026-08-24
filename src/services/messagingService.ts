import { supabase } from "../lib/supabase";

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

// Staff are loaded exclusively from authenticated Supabase staff profiles.
export const AECS_STAFF_18: StaffUser[] = [];

// Department Collaborative Channels
export const AECS_CHANNELS: ChatChannel[] = [
  {
    id: "ch-announcements",
    name: "general-announcements",
    description: "Office-wide announcements, policy updates, and executive briefings",
    topic: "📢 All 18 Staff Office Broadcast · Managed by Administration",
    category: "Broadcast",
    iconName: "Megaphone",
    memberCount: 18,
    unreadCount: 0,
  },
  {
    id: "ch-visa-compliance",
    name: "visa-compliance-desk",
    description: "Urgent visa submissions, biometrics slots, CAS/I-20 follow-ups, and embassy policy bulletins",
    topic: "🛂 Visa & Embassy Lodgement Coordination",
    category: "Department",
    iconName: "ShieldCheck",
    memberCount: 8,
    unreadCount: 0,
  },
  {
    id: "ch-counselling-admissions",
    name: "study-abroad-counsellors",
    description: "University application submissions, conditional offer tracking, and scholarship matching",
    topic: "🌍 Global Admissions & Direct University Applications",
    category: "Department",
    iconName: "Globe",
    memberCount: 10,
    unreadCount: 0,
  },
  {
    id: "ch-test-prep",
    name: "test-prep-faculty",
    description: "IELTS, PTE, Duolingo, German, Japanese, and Korean class batches & mock score logs",
    topic: "📖 Faculty Class Rosters & Diagnostic Test Scores",
    category: "Department",
    iconName: "BookOpen",
    memberCount: 7,
    unreadCount: 0,
  },
  {
    id: "ch-finance",
    name: "finance-accounts-desk",
    description: "Student tuition receipts, invoice generation, voucher auditing, and B2B commission reconciliations",
    topic: "💳 Accounting, eSewa/Bank Vouchers & Revenue Ledgers",
    category: "Department",
    iconName: "CreditCard",
    memberCount: 5,
    unreadCount: 0,
  },
  {
    id: "ch-front-desk",
    name: "front-desk-intake",
    description: "Walk-in inquiries, appointment scheduling, phone reception, and student welcome desk",
    topic: "🛎️ Daily Walk-in Lead Registrations & Consultations",
    category: "Department",
    iconName: "Users",
    memberCount: 9,
    unreadCount: 0,
  },
];

export const MessagingService = {
  getStaff: async ():Promise<StaffUser[]> => {const{data,error}=await supabase.from("staff_profiles").select("id,full_name,email,role,department,phone,avatar_bg").eq("is_active",true).order("full_name");if(error)throw error;return(data??[]).map(s=>({id:String(s.id),fullName:s.full_name?.trim()||"Staff member",email:s.email?.trim()||"",role:s.role?.trim()||"Staff",department:(s.department?.trim()||"IT & Operations")as StaffUser["department"],presence:"OFFLINE",avatarBg:s.avatar_bg||"#F97316",phone:s.phone??undefined}))},
  getChannels: async ():Promise<ChatChannel[]> => {const{data,error}=await supabase.from("communication_channels").select("id,name,description,category,is_private,communication_channel_members(count)").order("name");if(error)throw error;return(data??[]).map(c=>({id:c.id,name:c.name,description:c.description??"",topic:c.description??"",category:c.category==="BROADCAST"?"Broadcast":c.category==="CASE"?"Admissions":"Department",iconName:c.category==="BROADCAST"?"Megaphone":"Users",isPrivate:c.is_private,memberCount:c.communication_channel_members?.[0]?.count??0,unreadCount:0}))},
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
    const channelName = `crm-communications-${crypto.randomUUID()}`;
    const channel=supabase.channel(channelName).on("postgres_changes",{event:"*",schema:"public",table:"communication_messages"},onUpdate).on("postgres_changes",{event:"*",schema:"public",table:"communication_reactions"},onUpdate).subscribe();return()=>{void supabase.removeChannel(channel)};
  },
};
