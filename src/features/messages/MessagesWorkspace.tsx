import { AnimatePresence, motion } from "framer-motion";
import { CountryDisplay } from "../../components/ui/CountryDisplay";
import {
  AlertCircle,
  Archive,
  ArrowRight,
  AtSign,
  Award,
  Bell,
  BookOpen,
  Building,
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Layers,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Mic,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Phone,
  PhoneCall,
  Pin,
  PlaneTakeoff,
  Plus,
  RotateCcw,
  Search,
  Send,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smile,
  Sparkles,
  Tag,
  ThumbsUp,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type ChatAttachment,
  type ChatChannel,
  type ChatMessage,
  MessagingService,
  type StaffUser,
} from "../../services/messagingService";
import { StudentService } from "../../services/studentService";
import { useAuth } from "../auth/AuthProvider";
import { unlockMessageAudio } from "../../components/common/GlobalMessageNotifier";
import {
  type ActiveCallSession,
  CallingService,
} from "../../services/callingService";
import { CallModal } from "../../components/calling/CallModal";
import { notifyError } from "../../components/common/CrmNotifications";

const QUICK_REACTION_EMOJIS = ["👍", "❤️", "😆", "😮", "😢", "🔥"];
const messageDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const messageDateLabel = (createdAt: string, includeTime = false) => {
  const date = new Date(createdAt);
  const today = messageDay(new Date());
  const yesterday = messageDay(new Date(Date.now() - 86_400_000));
  const day = messageDay(date);
  const label = day === today ? "Today" : day === yesterday ? "Yesterday" : new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", year: day.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" }).format(date);
  return includeTime ? `${label} · ${new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true }).format(date)}` : label;
};
const formatSeenStatus = (readAt: string) => {
  const elapsed = Math.max(0, Date.now() - new Date(readAt).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Seen now";
  if (minutes < 60) return `Seen ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Seen ${hours} hr${hours === 1 ? "" : "s"} ago`;
  return `Seen ${Math.floor(hours / 24)} day${hours < 48 ? "" : "s"} ago`;
};

export function MessagesWorkspace() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Active logged in staff member
  const currentStaff = useMemo(() => {
    if (!profile) {
      return {id:"pending-session",fullName:"Staff",email:"",role:"Staff",department:"IT & Operations" as const,presence:"OFFLINE" as const,avatarBg:"#F97316"};
    }
    const profileEmail = profile.email?.trim().toLowerCase() || "";
    const match = staffUsers.find(
      s => (profileEmail !== "" && s.email.toLowerCase() === profileEmail) || s.id === profile.id
    );
    return match || {id:profile.id,fullName:profile.full_name?.trim()||"Staff member",email:profile.email?.trim()||"",role:profile.role?.trim()||"Staff",department:"IT & Operations" as const,presence:"ONLINE" as const,avatarBg:profile.avatarBg||"#F97316"};
  }, [profile, staffUsers]);

  const currentUserId = currentStaff.id;

  // Active chat state with localStorage persistence across refreshes
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(() => {
    const savedChannel = localStorage.getItem("aecs_active_chat_channel");
    if (savedChannel) return null;
    const savedRecipient = localStorage.getItem("aecs_active_chat_recipient");
    if (savedRecipient && savedRecipient !== currentUserId) return savedRecipient;
    return null;
  });
  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => {
    return localStorage.getItem("aecs_active_chat_channel");
  });

  // Filter Tabs: 'all' | 'unread' | 'channels'
  const [sidebarFilter, setSidebarFilter] = useState<"all" | "unread" | "channels">("all");

  // Data state
  const [registeredStudents, setRegisteredStudents] = useState<any[]>([]);

  // Composer state
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTagModal, setShowTagModal] = useState(false);
  const [showGroupModal,setShowGroupModal]=useState(false);
  const [groupForm,setGroupForm]=useState({name:"",description:"",memberIds:[] as string[]});
  const [groupSaving,setGroupSaving]=useState(false);
  const [groupError,setGroupError]=useState("");
  const [selectedStudentTag, setSelectedStudentTag] = useState<{ code: string; name: string } | null>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showInfoSidebar, setShowInfoSidebar] = useState(true);
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [outgoingCallSession, setOutgoingCallSession] = useState<ActiveCallSession | null>(null);
  const[alertsEnabled,setAlertsEnabled]=useState(()=>"Notification" in window&&Notification.permission==="granted");
  const [,setReceiptClock]=useState(0);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{const timer=window.setInterval(()=>setReceiptClock(value=>value+1),60_000);return()=>window.clearInterval(timer)},[]);

  const handleStartVoiceCall = async () => {
    if (!currentRecipient) return;
    try{const session = await CallingService.startCall(currentStaff, currentRecipient, "audio");setOutgoingCallSession(session)}
    catch(error){notifyError("Voice call could not start",error instanceof Error?error.message:"Check microphone access and try again")}
  };
  const enableAlerts=async()=>{await unlockMessageAudio();if("Notification" in window){const permission=await Notification.requestPermission();setAlertsEnabled(permission==="granted")}else setAlertsEnabled(true)};

  const handleSelectRecipient = (id: string) => {
    setActiveChannelId(null);
    setActiveRecipientId(id);
    localStorage.setItem("aecs_active_chat_recipient", id);
    localStorage.removeItem("aecs_active_chat_channel");
  };

  const handleSelectChannel = (id: string) => {
    setActiveRecipientId(null);
    setActiveChannelId(id);
    localStorage.setItem("aecs_active_chat_channel", id);
    localStorage.removeItem("aecs_active_chat_recipient");
  };

  // Load chat messages
  const loadMessages = async () => {
    try {
      setLoadError("");
      const [msgs,staff,availableChannels] = await Promise.all([MessagingService.getMessages(),MessagingService.getStaff(),MessagingService.getChannels()]);
      setMessages(msgs);
      setStaffUsers(staff);
      setChannels(availableChannels);
      const studs = await StudentService.getStudents();
      setRegisteredStudents(studs || []);

      // Discard a selection that no longer exists after staff/data cleanup.
      const savedRec = localStorage.getItem("aecs_active_chat_recipient");
      const savedCh = localStorage.getItem("aecs_active_chat_channel");
      if (savedRec && !staff.some(member => member.id === savedRec)) {
        localStorage.removeItem("aecs_active_chat_recipient");
        setActiveRecipientId(null);
      }
      if (savedCh && !availableChannels.some(channel => channel.id === savedCh)) {
        localStorage.removeItem("aecs_active_chat_channel");
        setActiveChannelId(null);
      }

      if (!savedRec && !savedCh && msgs.length > 0) {
        const myLatest = [...msgs].reverse().find(
          m => (m.senderId === currentUserId && m.recipientId) || (m.recipientId === currentUserId)
        );
        if (myLatest) {
          const otherId = myLatest.senderId === currentUserId ? myLatest.recipientId : myLatest.senderId;
          if (otherId && otherId !== currentUserId && staff.some(member => member.id === otherId)) {
            setActiveRecipientId(otherId);
            localStorage.setItem("aecs_active_chat_recipient", otherId);
          }
        }
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Communications could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const unsubscribe = MessagingService.subscribeToSyncEvents(loadMessages);
    const fallbackRefresh = window.setInterval(() => { if (!document.hidden) void loadMessages(); }, 15_000);
    return () => {
      unsubscribe();
      window.clearInterval(fallbackRefresh);
    };
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, activeRecipientId, activeChannelId]);

  // Current active conversation target
  const currentRecipient = useMemo(() => {
    if (!activeRecipientId) return null;
    return staffUsers.find(u => u.id === activeRecipientId) || staffUsers[0];
  }, [activeRecipientId, staffUsers]);

  const currentChannel = useMemo(() => {
    if (!activeChannelId) return null;
    return channels.find(c => c.id === activeChannelId) || channels[0];
  }, [activeChannelId, channels]);

  // Filter messages for current thread - 100% PRIVATE DIRECT MESSAGING
  const threadMessages = useMemo(() => {
    return messages.filter(msg => {
      if (activeRecipientId) {
        // Direct messages are ONLY visible to the 2 participating users
        return (
          (msg.senderId === currentUserId && msg.recipientId === activeRecipientId) ||
          (msg.senderId === activeRecipientId && msg.recipientId === currentUserId)
        );
      } else if (activeChannelId) {
        return msg.channelId === activeChannelId;
      }
      return false;
    });
  }, [messages, activeRecipientId, activeChannelId, currentUserId]);

  const latestIncomingId = useMemo(
    () => [...threadMessages].reverse().find(message => message.senderId !== currentUserId)?.id,
    [threadMessages, currentUserId],
  );
  const latestOutgoingId = useMemo(
    () => [...threadMessages].reverse().find(message => message.senderId === currentUserId)?.id,
    [threadMessages, currentUserId],
  );

  useEffect(() => {
    if (!activeRecipientId && !activeChannelId) return;
    void MessagingService.markConversationRead({
      recipientId: activeRecipientId ?? undefined,
      channelId: activeChannelId ?? undefined,
    }).then(loadMessages).catch(() => {});
  }, [activeRecipientId, activeChannelId, latestIncomingId]);

  const conversationAttachments = useMemo(
    () => threadMessages.flatMap(message =>
      (message.attachments ?? []).map((attachment, index) => ({
        ...attachment,
        key: `${message.id}-${index}`,
        senderName: message.senderName,
        timestamp: message.timestamp,
      })),
    ),
    [threadMessages],
  );

  // Message count and latest message preview per contact - strictly for the logged-in user
  const conversationSummaries = useMemo(() => {
    const summaries: Record<string, { lastMsg: ChatMessage | null; count: number }> = {};

    for (const u of staffUsers) {
      const msgs = messages.filter(
        m =>
          (m.senderId === currentUserId && m.recipientId === u.id) ||
          (m.senderId === u.id && m.recipientId === currentUserId)
      );
      summaries[u.id] = {
        lastMsg: msgs.length > 0 ? msgs.reduce((latest, message) => message.createdAt > latest.createdAt ? message : latest) : null,
        count: msgs.filter(message => message.senderId === u.id && message.recipientId === currentUserId && !message.readAt).length,
      };
    }

    for (const ch of channels) {
      const msgs = messages.filter(m => m.channelId === ch.id);
      summaries[ch.id] = {
        lastMsg: msgs.length > 0 ? msgs.reduce((latest, message) => message.createdAt > latest.createdAt ? message : latest) : null,
        count: msgs.filter(message => message.senderId !== currentUserId && !message.isReadByCurrentUser).length,
      };
    }

    return summaries;
  }, [messages, staffUsers, channels, currentUserId]);

  // Filtered contacts list
  const filteredStaffList = useMemo(() => {
    return staffUsers.filter(u => {
      if (u.id === currentUserId) return false; // Don't show myself in chat list
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.fullName.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [staffUsers, currentUserId, searchQuery]);

  // Sort contacts by recency so active chats are always at the top (like Messenger)
  const sortedStaffList = useMemo(() => {
    return [...filteredStaffList].sort((a, b) => {
      const summaryA = conversationSummaries[a.id];
      const summaryB = conversationSummaries[b.id];
      if (summaryA?.lastMsg && !summaryB?.lastMsg) return -1;
      if (!summaryA?.lastMsg && summaryB?.lastMsg) return 1;
      if (summaryA?.lastMsg && summaryB?.lastMsg) {
        return new Date(summaryB.lastMsg.createdAt).getTime() - new Date(summaryA.lastMsg.createdAt).getTime();
      }
      return a.fullName.localeCompare(b.fullName);
    });
  }, [filteredStaffList, conversationSummaries]);
  const sortedChannels = useMemo(() => [...channels].sort((a, b) => {
    const recentA = conversationSummaries[a.id]?.lastMsg?.createdAt;
    const recentB = conversationSummaries[b.id]?.lastMsg?.createdAt;
    if (recentA && recentB) return recentB.localeCompare(recentA);
    if (recentA) return -1;
    if (recentB) return 1;
    return a.name.localeCompare(b.name);
  }), [channels, conversationSummaries]);

  const stageFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...files];
    if (stagedFiles.length + next.length > 5) { notifyError("Too many attachments", "Attach up to five files per message."); return; }
    const invalid = next.find(file => file.size > 20 * 1024 * 1024);
    if (invalid) { notifyError("File too large", `${invalid.name} exceeds 20 MB.`); return; }
    setStagedFiles(current => [...current, ...next]);
  };
  const openAttachment = async (attachment: ChatAttachment) => {
    try { window.open(await MessagingService.attachmentUrl(attachment), "_blank", "noopener,noreferrer"); }
    catch (error) { notifyError("Cannot open attachment", error instanceof Error ? error.message : "The file is unavailable."); }
  };

  // Send message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText !== undefined ? customText : inputText;
    if (sendingMessage || (!textToSend.trim() && stagedFiles.length === 0)) return;
    setSendingMessage(true);
    const uploaded: ChatAttachment[] = [];
    let committed = false;
    try {
    for (const file of stagedFiles) uploaded.push(await MessagingService.uploadAttachment(file));
    await MessagingService.sendMessage({
      senderId: currentUserId,
      senderName: currentStaff.fullName,
      senderRole: currentStaff.role,
      senderAvatarBg: currentStaff.avatarBg || "#F97316",
      channelId: activeChannelId || undefined,
      recipientId: activeRecipientId || undefined,
      content: textToSend.trim() || `📎 ${stagedFiles.map(file => file.name).join(", ")}`,
      taggedStudentCode: selectedStudentTag?.code,
      taggedStudentName: selectedStudentTag?.name,
      attachments: uploaded.length > 0 ? uploaded : undefined,
    });
    committed = true;

    setInputText("");
    setSelectedStudentTag(null);
    setStagedFiles([]);
    await loadMessages();
    } catch (error) {
      if (!committed) await MessagingService.removeAttachments(uploaded.map(item => item.path!).filter(Boolean));
      notifyError("Message not sent", error instanceof Error ? error.message : "Please try again.");
    } finally { setSendingMessage(false); }
  };

  // Quick Like (Thumbs Up)
  const handleSendThumbsUp = () => {
    handleSendMessage("👍");
  };
  const toggleGroupMember=(id:string)=>setGroupForm(current=>({...current,memberIds:current.memberIds.includes(id)?current.memberIds.filter(item=>item!==id):[...current.memberIds,id]}));
  const createGroup=async()=>{try{setGroupSaving(true);setGroupError("");if(groupForm.name.trim().length<2)throw new Error("Enter a group name with at least 2 characters.");if(!groupForm.memberIds.length)throw new Error("Select at least one other staff member.");const id=await MessagingService.createStaffGroup({name:groupForm.name.trim(),description:groupForm.description.trim(),memberIds:groupForm.memberIds});await loadMessages();handleSelectChannel(id);setShowGroupModal(false);setGroupForm({name:"",description:"",memberIds:[]})}catch(reason){setGroupError(reason instanceof Error?reason.message:"The staff group could not be created.")}finally{setGroupSaving(false)}};

  // Toggle Reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    const updated = await MessagingService.toggleReaction(messageId, emoji, currentStaff.fullName);
    setMessages(updated);
  };

  if (isLoading) {
    return <div className="page-container"><div className="empty-state"><h3>Loading communications…</h3></div></div>;
  }

  if (loadError) {
    return <div className="page-container"><div className="empty-state"><AlertCircle size={28}/><h3>Communications unavailable</h3><p>{loadError}</p><button type="button" className="btn-primary" onClick={() => void loadMessages()}>Try again</button></div></div>;
  }

  if (sortedStaffList.length === 0 && channels.length === 0) {
    return <div className="page-container"><div className="empty-state"><MessageSquare size={32}/><h3>No conversations yet</h3><p>Add another authenticated staff account to start secure internal messaging.</p></div></div>;
  }

  return (
    <div className="page-container messages-page">
      <div className="messenger-container">
        {/* =========================================================================
            PANE 1: LEFT CHATS SIDEBAR (MESSENGER STYLE)
            ========================================================================= */}
        <div className="messenger-sidebar">
          {/* Header */}
          <div className="messenger-sidebar-header">
            <div className="messenger-header-top">
              <h2 className="messenger-title">Chats</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button type="button" className={`messenger-icon-btn ${alertsEnabled?"alerts-ready":""}`} onClick={()=>void enableAlerts()} title={alertsEnabled?"Message and call alerts enabled":"Enable message and call alerts"}><Bell size={16}/></button>
                <button
                  type="button"
                  className="messenger-icon-btn"
                  onClick={() => setShowTagModal(true)}
                  title="Reference a Student Case"
                >
                  <Tag size={16} />
                </button>
                <button type="button" className="messenger-icon-btn" onClick={()=>{setGroupError("");setShowGroupModal(true)}} title="Create a staff group" aria-label="Create staff group"><UserPlus size={16}/></button>
              </div>
            </div>

            {/* Messenger Search Bar */}
            <div className="messenger-search-pill">
              <Search size={15} className="messenger-search-icon" />
              <input
                type="text"
                className="messenger-search-input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Messenger…"
              />
            </div>
          </div>

          {/* Filter Chips: All | Unread | Channels */}
          <div className="messenger-filter-tabs">
            <button
              type="button"
              className={`messenger-filter-chip ${sidebarFilter === "all" ? "active" : ""}`}
              onClick={() => setSidebarFilter("all")}
            >
              All ({Math.max(0, staffUsers.filter(user => user.id !== currentUserId).length)})
            </button>
            <button
              type="button"
              className={`messenger-filter-chip ${sidebarFilter === "channels" ? "active" : ""}`}
              onClick={() => setSidebarFilter("channels")}
            >
              Channels ({channels.length})
            </button>
          </div>

          {/* Chats Scroll List */}
          <div className="messenger-chat-list">
            {sidebarFilter === "channels" ? (
              /* Channel Rooms */
              sortedChannels.map(ch => {
                const isActive = activeChannelId === ch.id;
                const summary = conversationSummaries[ch.id];

                return (
                  <button
                    key={ch.id}
                    type="button"
                    className={`messenger-chat-item ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectChannel(ch.id)}
                  >
                    <div className="messenger-avatar-wrap">
                      <div
                        className="messenger-avatar-circle"
                        style={{ background: ch.category === "Broadcast" ? "#F59E0B" : "#F97316" }}
                      >
                        {ch.category === "Broadcast" ? <Megaphone size={18} /> : <Hash size={18} />}
                      </div>
                    </div>

                    <div className="messenger-chat-meta">
                      <div className="messenger-chat-top-line">
                        <span className="messenger-chat-name">#{ch.name}</span>
                        {summary?.lastMsg && (
                          <span className="messenger-chat-time">{messageDateLabel(summary.lastMsg.createdAt)}</span>
                        )}
                      </div>
                      <div className="messenger-chat-preview-line">
                        <span className="messenger-chat-snippet">
                          {summary?.lastMsg ? summary.lastMsg.content : ch.description}
                        </span>
                        {summary?.count > 0 && (
                          <span className="messenger-unread-dot" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              /* Active staff direct messages, sorted with recent conversations first */
              sortedStaffList.map(staff => {
                const isActive = activeRecipientId === staff.id;
                const summary = conversationSummaries[staff.id];
                const initials = staff.fullName.substring(0, 2).toUpperCase();

                return (
                  <button
                    key={staff.id}
                    type="button"
                    className={`messenger-chat-item ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectRecipient(staff.id)}
                  >
                    <div className="messenger-avatar-wrap">
                      <div className="messenger-avatar-circle" style={{ background: staff.avatarBg }}>
                        {staff.avatarUrl?<img src={staff.avatarUrl} alt={`${staff.fullName} profile`}/>:initials}
                      </div>
                      {staff.presence === "ONLINE" && <div className="messenger-presence-badge" />}
                    </div>

                    <div className="messenger-chat-meta">
                      <div className="messenger-chat-top-line">
                        <span className="messenger-chat-name">{staff.fullName}</span>
                        {summary?.lastMsg && (
                          <span className="messenger-chat-time">{messageDateLabel(summary.lastMsg.createdAt)}</span>
                        )}
                      </div>
                      <div className="messenger-chat-preview-line">
                        <span className="messenger-chat-snippet">
                          {summary?.lastMsg ? (
                            summary.lastMsg.senderId === currentUserId ? `You: ${summary.lastMsg.content}` : summary.lastMsg.content
                          ) : (
                            `${staff.role.split("·")[0]} · ${staff.department.split(" ")[0]}`
                          )}
                        </span>
                        {summary?.count > 0 && (
                          <span className="messenger-unread-dot" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* =========================================================================
            PANE 2: CENTER CHAT WINDOW (MESSENGER BUBBLES & COMPOSER)
            ========================================================================= */}
        <div className="messenger-main">
          {/* Header Bar */}
          <div className="messenger-main-header">
            <div className="messenger-main-header-info">
              {activeRecipientId ? (
                <>
                  <div className="messenger-avatar-wrap">
                    <div
                      className="messenger-avatar-circle"
                      style={{ width: "40px", height: "40px", background: currentRecipient?.avatarBg || "#F97316" }}
                    >
                      {currentRecipient?.avatarUrl?<img src={currentRecipient.avatarUrl} alt={`${currentRecipient.fullName} profile`}/>:currentRecipient?.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    {currentRecipient?.presence === "ONLINE" && <div className="messenger-presence-badge" />}
                  </div>
                  <div className="messenger-header-details">
                    <h3>{currentRecipient?.fullName}</h3>
                    <span>
                      {currentRecipient?.presence === "ONLINE"
                        ? "Active now"
                        : currentRecipient?.presence === "IN_MEETING"
                        ? "In Counselling Session"
                        : "Offline"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="messenger-avatar-wrap">
                    <div className="messenger-avatar-circle" style={{ width: "40px", height: "40px", background: "#F97316" }}>
                      <Hash size={18} />
                    </div>
                  </div>
                  <div className="messenger-header-details">
                    <h3>#{currentChannel?.name}</h3>
                    <span style={{ color: "var(--text-muted)" }}>{currentChannel?.topic}</span>
                  </div>
                </>
              )}
            </div>

            <div className="messenger-header-actions">
              {activeRecipientId&&<button
                type="button"
                className="messenger-icon-btn"
                onClick={handleStartVoiceCall}
                title="Start voice call"
              >
                <Phone size={17} style={{ color: "#F97316" }} />
              </button>}

              <button
                type="button"
                className="messenger-icon-btn"
                onClick={() => setShowInfoSidebar(v => !v)}
                title="Conversation Information"
              >
                <Info size={18} style={{ color: showInfoSidebar ? "#F97316" : "inherit" }} />
              </button>
            </div>
          </div>

          {/* Message Stream */}
          <div ref={chatScrollRef} className="messenger-messages-stream">
            {/* Top Welcome Card */}
            {activeRecipientId && (
              <div className="messenger-welcome-card">
                <div
                  className="messenger-welcome-avatar"
                  style={{ background: currentRecipient?.avatarBg || "#F97316" }}
                >
                  {currentRecipient?.avatarUrl?<img src={currentRecipient.avatarUrl} alt={`${currentRecipient.fullName} profile`}/>:currentRecipient?.fullName.substring(0, 2).toUpperCase()}
                </div>
                <h3 style={{ fontSize: "17px", fontWeight: 800, margin: "0 0 2px 0" }}>
                  {currentRecipient?.fullName}
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>
                  {currentRecipient?.role} · {currentRecipient?.department}
                </span>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "8px 0 0 0" }}>
                  You're connected on AECS Internal CRM. Send a message or tag a student case to collaborate.
                </p>
              </div>
            )}

            {/* Bubble Stream */}
            {threadMessages.map(msg => {
              const isOutgoing = msg.senderId === currentUserId;

              return (
                <div
                  key={msg.id}
                  className={`messenger-msg-row ${isOutgoing ? "outgoing" : "incoming"}`}
                >
                  {!isOutgoing && (
                    <div
                      className="messenger-bubble-avatar"
                      style={{ background: msg.senderAvatarBg || "#F97316" }}
                    >
                      {msg.senderAvatarUrl?<img src={msg.senderAvatarUrl} alt={`${msg.senderName} profile`}/>:msg.senderName.substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="messenger-bubble">
                    <div className="messenger-message-meta">
                      <strong>{isOutgoing ? "You" : msg.senderName}</strong>
                      <span>{messageDateLabel(msg.createdAt, true)}</span>
                    </div>
                    {/* Clickable Student Tag Case */}
                    {msg.taggedStudentCode && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          background: isOutgoing ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 132, 255, 0.12)",
                          borderRadius: "10px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          marginBottom: "4px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                        onClick={() => navigate("/students")}
                      >
                        <Tag size={10} />
                        <span>Case: {msg.taggedStudentName || "Student"} ({msg.taggedStudentCode})</span>
                      </div>
                    )}

                    {/* Content */}
                    <div style={{ fontSize: msg.content === "👍" ? "32px" : "13.5px", lineHeight: 1.4 }}>
                      {msg.content}
                    </div>

                    {/* Staged Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                        {msg.attachments.map((att, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              background: isOutgoing ? "rgba(255, 255, 255, 0.15)" : "var(--bg-card)",
                              borderRadius: "8px",
                              padding: "6px 10px",
                              fontSize: "12px",
                            }}
                          >
                            <FileText size={15} />
                            <div style={{ flex: 1, overflow: "hidden" }}>
                              <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{att.name}</strong>
                              <span style={{ fontSize: "10px", opacity: 0.8 }}>{att.size}</span>
                            </div>
                            <button type="button" onClick={() => void openAttachment(att)} title={`Open ${att.name}`} aria-label={`Open ${att.name}`} className="messenger-file-open"><Download size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reactions Pill on Bubble */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="messenger-reaction-pill">
                        {msg.reactions.map((r, i) => (
                          <span key={i}>{r.emoji} {r.count > 1 ? r.count : ""}</span>
                        ))}
                      </div>
                    )}

                    {/* Floating Reaction Bar on Hover */}
                    <div className="messenger-bubble-actions">
                      {QUICK_REACTION_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          style={{
                            background: "transparent",
                            border: "none",
                            fontSize: "13px",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                          onClick={() => handleReaction(msg.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  {isOutgoing && msg.id === latestOutgoingId && msg.readAt && (
                    <div className="messenger-seen-status"><CheckCheck size={12}/>{activeChannelId ? `Seen by ${msg.readCount ?? 0}` : formatSeenStatus(msg.readAt)}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Staged Attachments Preview Above Input */}
          {(selectedStudentTag || stagedFiles.length > 0) && (
            <div
              style={{
                padding: "8px 18px",
                background: "var(--bg-card-subtle)",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {selectedStudentTag && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(0, 132, 255, 0.12)",
                    borderRadius: "14px",
                    padding: "3px 10px",
                    fontSize: "11.5px",
                    color: "#F97316",
                    fontWeight: 600,
                  }}
                >
                  <Tag size={11} />
                  <span>{selectedStudentTag.name} ({selectedStudentTag.code})</span>
                  <X size={12} style={{ cursor: "pointer" }} onClick={() => setSelectedStudentTag(null)} />
                </div>
              )}

              {stagedFiles.map((att, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "14px",
                    padding: "3px 10px",
                    fontSize: "11.5px",
                  }}
                >
                  <FileText size={11} style={{ color: "#F97316" }} />
                  <span>{att.name}</span>
                  <X
                    size={12}
                    style={{ cursor: "pointer" }}
                  onClick={() => setStagedFiles(stagedFiles.filter((_, i) => i !== idx))}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Messenger Composer Toolbar */}
          <div className="messenger-composer-bar">
            <div className="messenger-composer-actions-left">
              {/* Tag Student */}
              <button
                type="button"
                className="messenger-action-icon-btn"
                onClick={() => setShowTagModal(true)}
                title="Tag Student Case"
              >
                <Plus size={18} />
              </button>

              <input ref={fileInputRef} type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt" onChange={event => { stageFiles(event.target.files); event.target.value = ""; }} />
              {/* Attach Document */}
              <button
                type="button"
                className="messenger-action-icon-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
              >
                <Paperclip size={18} />
              </button>

              {/* Attach Image */}
              <button
                type="button"
                className="messenger-action-icon-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach images"
              >
                <ImageIcon size={18} />
              </button>
            </div>

            {/* Text Input */}
            <div className="messenger-input-wrap">
              <input
                type="text"
                className="messenger-text-input"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  activeRecipientId
                    ? `Message ${currentRecipient?.fullName}…`
                    : `Message #${currentChannel?.name}…`
                }
              />
            </div>

            {/* Giant Blue Thumbs Up OR Send Button */}
            {inputText.trim() || stagedFiles.length > 0 ? (
              <button
                type="button"
                className="messenger-send-btn"
                onClick={() => handleSendMessage()}
                disabled={sendingMessage}
                title="Send Message"
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="messenger-send-btn"
                onClick={handleSendThumbsUp}
                title="Send Like"
              >
                <ThumbsUp size={20} />
              </button>
            )}
          </div>
        </div>

        {/* =========================================================================
            PANE 3: RIGHT PROFILE & CONVERSATION INFO DRAWER
            ========================================================================= */}
        {showInfoSidebar && (
          <div className="messenger-info-drawer">
            {activeRecipientId ? (
              <div className="messenger-info-profile-card">
                <div
                  className="messenger-info-avatar-large"
                  style={{ background: currentRecipient?.avatarBg || "#F97316" }}
                >
                  {currentRecipient?.fullName.substring(0, 2).toUpperCase()}
                </div>
                <h3 className="messenger-info-name">{currentRecipient?.fullName}</h3>
                <span className="messenger-info-role">{currentRecipient?.role}</span>
                <span className="messenger-info-status">
                  ● {currentRecipient?.presence === "ONLINE" ? "Active Now" : "Away"}
                </span>

                <div className="messenger-profile-actions">
                  <button type="button" onClick={handleStartVoiceCall}><Phone size={15}/><span>Call</span></button>
                  <a href={`mailto:${currentRecipient?.email ?? ""}`}><MessageSquare size={15}/><span>Email</span></a>
                </div>

                <div style={{ marginTop: "20px", width: "100%", display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px", textAlign: "left" }}>
                  <div style={{ padding: "10px", background: "var(--bg-card-subtle)", borderRadius: "8px" }}>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>Department</span>
                    <strong>{currentRecipient?.department}</strong>
                  </div>
                  <div style={{ padding: "10px", background: "var(--bg-card-subtle)", borderRadius: "8px" }}>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>Email</span>
                    <strong>{currentRecipient?.email}</strong>
                  </div>
                  <div style={{ padding: "10px", background: "var(--bg-card-subtle)", borderRadius: "8px" }}>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "10px", textTransform: "uppercase" }}>Direct Phone</span>
                    <strong>{currentRecipient?.phone}</strong>
                  </div>
                </div>

                <div style={{ marginTop: "16px", width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: "100%", justifyContent: "center", fontSize: "12px" }}
                    onClick={() => navigate("/students")}
                  >
                    <Users size={13} style={{ color: "#F97316" }} />
                    <span>Open Student Directory</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: "100%", justifyContent: "center", fontSize: "12px" }}
                    onClick={() => navigate("/applications")}
                  >
                    <PlaneTakeoff size={13} style={{ color: "#F59E0B" }} />
                    <span>Visa Applications</span>
                  </button>
                </div>

                <section className="messenger-attachment-panel">
                  <header><div><FileText size={15}/><strong>Attachments</strong></div><span>{conversationAttachments.length}</span></header>
                  {conversationAttachments.length ? (
                    <div className="messenger-attachment-list">
                      {conversationAttachments.map(attachment => (
                        <button key={attachment.key} type="button" onClick={() => void openAttachment(attachment)}>
                          <span className="messenger-file-icon"><FileText size={16}/></span>
                          <span><strong>{attachment.name}</strong><small>{attachment.size} · {attachment.senderName}</small></span>
                          <Download size={14}/>
                        </button>
                      ))}
                    </div>
                  ) : <p>No files shared in this conversation.</p>}
                </section>
              </div>
            ) : (
              <div style={{ textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <div className="messenger-avatar-circle" style={{ width: "44px", height: "44px", background: "#F97316" }}>
                    <Hash size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>#{currentChannel?.name}</h3>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{currentChannel?.category}</span>
                  </div>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {currentChannel?.description}
                </p>
                <div style={{ marginTop: "16px" }}>
                  <strong style={{ fontSize: "12px", display: "block", marginBottom: "8px" }}>
                    Channel Members ({currentChannel?.memberCount} Staff)
                  </strong>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {staffUsers.slice(0, 8).map(u => (
                      <div
                        key={u.id}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: u.avatarBg,
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                        title={u.fullName}
                      >
                        {u.fullName[0]}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL: TAG STUDENT CASE
          ========================================================================= */}
      <AnimatePresence>
        {showGroupModal&&<div className="modal-backdrop-clean" onClick={()=>setShowGroupModal(false)}><motion.div initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.96,opacity:0}} className="modal-dialog-clean staff-group-modal" onClick={event=>event.stopPropagation()}>
          <div className="modal-header-clean"><div><span className="staff-group-eyebrow">AECS internal communications</span><h3>Create staff group</h3><p>Start a private workspace with selected Bagbazar staff members.</p></div><button type="button" className="drawer-close-btn" onClick={()=>setShowGroupModal(false)}><X size={18}/></button></div>
          <div className="modal-body-clean"><label className="staff-group-field"><span>Group name *</span><input value={groupForm.name} maxLength={80} onChange={event=>setGroupForm({...groupForm,name:event.target.value})} placeholder="Example: Admissions operations"/></label><label className="staff-group-field"><span>Description</span><textarea value={groupForm.description} maxLength={300} onChange={event=>setGroupForm({...groupForm,description:event.target.value})} placeholder="What should this group coordinate?"/></label><div className="staff-group-member-head"><div><strong>Select staff members</strong><small>You are added automatically.</small></div><span>{groupForm.memberIds.length} selected</span></div><div className="staff-group-member-list">{staffUsers.filter(member=>member.id!==currentUserId).map(member=><label key={member.id} className={groupForm.memberIds.includes(member.id)?"selected":""}><input type="checkbox" checked={groupForm.memberIds.includes(member.id)} onChange={()=>toggleGroupMember(member.id)}/><span className="staff-group-avatar" style={{background:member.avatarBg}}>{member.fullName.slice(0,2).toUpperCase()}</span><div><strong>{member.fullName}</strong><small>{member.role} · {member.department}</small></div><Check size={15}/></label>)}</div>{groupError&&<div className="staff-group-error"><AlertCircle size={15}/>{groupError}</div>}</div>
          <div className="modal-footer-clean"><button type="button" className="btn-secondary" onClick={()=>setShowGroupModal(false)}>Cancel</button><button type="button" className="btn-primary" disabled={groupSaving||!groupForm.name.trim()||!groupForm.memberIds.length} onClick={()=>void createGroup()}><Users size={15}/>{groupSaving?"Creating…":"Create group"}</button></div>
        </motion.div></div>}
      </AnimatePresence>
      <AnimatePresence>
        {showTagModal && (
          <div className="modal-backdrop-clean" onClick={() => setShowTagModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-dialog-clean"
              style={{ maxWidth: "460px" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header-clean">
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    Tag Student Case in Chat
                  </h3>
                  <p style={{ fontSize: "11.5px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Colleagues can click the badge to view the student profile
                  </p>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowTagModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body-clean">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {registeredStudents.length === 0 ? (
                    <div style={{ padding: "16px", background: "var(--bg-card-subtle)", borderRadius: "8px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                      No registered students found. Type a student name or code below:
                      <div style={{ marginTop: "10px" }}>
                        <input
                          type="text"
                          className="crm-input"
                          placeholder="e.g. AECS-2026-00001 (Riya Sharma)"
                          onKeyDown={e => {
                            if (e.key === "Enter" && (e.target as HTMLInputElement).value) {
                              setSelectedStudentTag({
                                code: (e.target as HTMLInputElement).value.split(" ")[0],
                                name: (e.target as HTMLInputElement).value,
                              });
                              setShowTagModal(false);
                            }
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    registeredStudents.map(st => (
                      <button
                        key={st.id}
                        type="button"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-subtle)",
                          background: "var(--bg-card)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onClick={() => {
                          setSelectedStudentTag({
                            code: st.code,
                            name: st.fullName,
                          });
                          setShowTagModal(false);
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "13px", color: "var(--text-main)" }}>{st.fullName}</strong>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>
                            {st.code} · <CountryDisplay country={st.targetCountry || "Study Abroad"} size={13}/>
                          </span>
                        </div>
                        <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          ACTIVE OUTGOING CALL MODAL
          ========================================================================= */}
      {outgoingCallSession && (
        <CallModal
          session={outgoingCallSession}
          currentUserId={currentUserId}
          onClose={() => setOutgoingCallSession(null)}
        />
      )}
    </div>
  );
}

export default MessagesWorkspace;
