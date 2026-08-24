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
  Video,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AECS_CHANNELS,
  type ChatAttachment,
  type ChatChannel,
  type ChatMessage,
  MessagingService,
  type StaffUser,
} from "../../services/messagingService";
import { StudentService } from "../../services/studentService";
import { useAuth } from "../auth/AuthProvider";
import { playChimeNotification } from "../../components/common/GlobalMessageNotifier";
import {
  type ActiveCallSession,
  CallingService,
} from "../../services/callingService";
import { CallModal } from "../../components/calling/CallModal";

const QUICK_REACTION_EMOJIS = ["👍", "❤️", "😆", "😮", "😢", "🔥"];

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
  const [selectedStudentTag, setSelectedStudentTag] = useState<{ code: string; name: string } | null>(null);
  const [stagedAttachments, setStagedAttachments] = useState<ChatAttachment[]>([]);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [outgoingCallSession, setOutgoingCallSession] = useState<ActiveCallSession | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const handleStartVoiceCall = async () => {
    if (!currentRecipient) return;
    const session = await CallingService.startCall(currentStaff, currentRecipient, "audio");
    setOutgoingCallSession(session);
  };

  const handleStartVideoCall = async () => {
    if (!currentRecipient) return;
    const session = await CallingService.startCall(currentStaff, currentRecipient, "video");
    setOutgoingCallSession(session);
  };

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
    return () => {
      unsubscribe();
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
        lastMsg: msgs.length > 0 ? msgs[msgs.length - 1] : null,
        count: msgs.length,
      };
    }

    for (const ch of channels) {
      const msgs = messages.filter(m => m.channelId === ch.id);
      summaries[ch.id] = {
        lastMsg: msgs.length > 0 ? msgs[msgs.length - 1] : null,
        count: msgs.length,
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
      return 0;
    });
  }, [filteredStaffList, conversationSummaries]);

  // Send message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText !== undefined ? customText : inputText;
    if (!textToSend.trim() && stagedAttachments.length === 0) return;

    playChimeNotification();

    await MessagingService.sendMessage({
      senderId: currentUserId,
      senderName: currentStaff.fullName,
      senderRole: currentStaff.role,
      senderAvatarBg: currentStaff.avatarBg || "#F97316",
      channelId: activeChannelId || undefined,
      recipientId: activeRecipientId || undefined,
      content: textToSend.trim(),
      taggedStudentCode: selectedStudentTag?.code,
      taggedStudentName: selectedStudentTag?.name,
      attachments: stagedAttachments.length > 0 ? stagedAttachments : undefined,
    });

    setInputText("");
    setSelectedStudentTag(null);
    setStagedAttachments([]);
    await loadMessages();
  };

  // Quick Like (Thumbs Up)
  const handleSendThumbsUp = () => {
    handleSendMessage("👍");
  };

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
    <div className="page-container" style={{ padding: "16px 24px" }}>
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
                <button
                  type="button"
                  className="messenger-icon-btn"
                  onClick={() => setShowTagModal(true)}
                  title="Reference a Student Case"
                >
                  <Tag size={16} />
                </button>
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
              channels.map(ch => {
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
                          <span className="messenger-chat-time">{summary.lastMsg.timestamp}</span>
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
              /* 18 Staff Direct Messages (Sorted with active conversations on top) */
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
                        {initials}
                      </div>
                      {staff.presence === "ONLINE" && <div className="messenger-presence-badge" />}
                    </div>

                    <div className="messenger-chat-meta">
                      <div className="messenger-chat-top-line">
                        <span className="messenger-chat-name">{staff.fullName}</span>
                        {summary?.lastMsg && (
                          <span className="messenger-chat-time">{summary.lastMsg.timestamp}</span>
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
                      {currentRecipient?.fullName.substring(0, 2).toUpperCase()}
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
              <button
                type="button"
                className="messenger-icon-btn"
                onClick={handleStartVoiceCall}
                title="Start Encrypted Voice Call"
              >
                <Phone size={17} style={{ color: "#F97316" }} />
              </button>

              <button
                type="button"
                className="messenger-icon-btn"
                onClick={handleStartVideoCall}
                title="Start HD Video Conference"
              >
                <Video size={18} style={{ color: "#F97316" }} />
              </button>

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
                  {currentRecipient?.fullName.substring(0, 2).toUpperCase()}
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
                      {msg.senderName.substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="messenger-bubble">
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
                            <Download size={13} style={{ cursor: "pointer" }} />
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
                </div>
              );
            })}
          </div>

          {/* Staged Attachments Preview Above Input */}
          {(selectedStudentTag || stagedAttachments.length > 0) && (
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

              {stagedAttachments.map((att, idx) => (
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
                    onClick={() => setStagedAttachments(stagedAttachments.filter((_, i) => i !== idx))}
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

              {/* Attach Document */}
              <button
                type="button"
                className="messenger-action-icon-btn"
                disabled
                title="File attachments will be available after storage is configured"
              >
                <Paperclip size={18} />
              </button>

              {/* Attach Image */}
              <button
                type="button"
                className="messenger-action-icon-btn"
                disabled
                title="Image attachments will be available after storage is configured"
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
            {inputText.trim() || stagedAttachments.length > 0 ? (
              <button
                type="button"
                className="messenger-send-btn"
                onClick={() => handleSendMessage()}
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
