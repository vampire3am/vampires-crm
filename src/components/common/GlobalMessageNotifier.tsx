import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Check,
  Hash,
  MessageSquare,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { type ChatMessage, MessagingService } from "../../services/messagingService";

// Professional Web Audio Synthesizer for instant crystal-clear chime
export function playChimeNotification() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First tone (pleasant mid-tone D5: 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second tone (harmonic high chime A5: 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.08);
    gain2.gain.setValueAtTime(0.22, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.55);
  } catch (err) {
    console.warn("Audio notification playback failed:", err);
  }
}

export interface ActiveToastNotification {
  id: string;
  senderName: string;
  senderRole: string;
  senderAvatarBg: string;
  content: string;
  channelId?: string;
  recipientId?: string;
  senderId: string;
  timestamp: string;
}

export function GlobalMessageNotifier() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [toasts, setToasts] = useState<ActiveToastNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastProcessedMsgId = useRef<string | null>(null);
  const isFirstLoad = useRef(true);

  // Current logged in staff ID
  const currentStaffId = profile?.id ?? "pending-session";

  const checkForNewMessages = async () => {
    try {
      const allMsgs = await MessagingService.getMessages();
      if (!allMsgs || allMsgs.length === 0) return;

      const latestMsg = allMsgs[allMsgs.length - 1];

      // On initial boot, just record the latest message without dinging
      if (isFirstLoad.current) {
        lastProcessedMsgId.current = latestMsg.id;
        isFirstLoad.current = false;
        return;
      }

      // If a new message arrived
      if (latestMsg.id !== lastProcessedMsgId.current) {
        lastProcessedMsgId.current = latestMsg.id;

        // Don't notify if I am the sender
        if (latestMsg.senderId === currentStaffId) {
          return;
        }

        // Strict DM Privacy: If it's a private direct message and I am not the intended recipient, do NOT alert or display
        if (latestMsg.recipientId && latestMsg.recipientId !== currentStaffId) {
          return;
        }

        // Play Sound
        if (soundEnabled) {
          playChimeNotification();
        }

        // Show Visual Popup Toast
        const newToast: ActiveToastNotification = {
          id: latestMsg.id,
          senderName: latestMsg.senderName,
          senderRole: latestMsg.senderRole,
          senderAvatarBg: latestMsg.senderAvatarBg || "#F97316",
          content: latestMsg.content || "Sent an attachment",
          channelId: latestMsg.channelId,
          recipientId: latestMsg.recipientId,
          senderId: latestMsg.senderId,
          timestamp: latestMsg.timestamp,
        };

        setToasts(prev => [newToast, ...prev.slice(0, 2)]);

        // Auto-dismiss after 6 seconds
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== newToast.id));
        }, 6000);
      }
    } catch {}
  };

  useEffect(() => {
    // Initial fetch
    checkForNewMessages();

    // Subscribe to live SSE events across LAN
    const unsubscribe = MessagingService.subscribeToSyncEvents(checkForNewMessages);

    // Fast polling fallback (every 2.5s)
    const interval = setInterval(checkForNewMessages, 2500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentStaffId, soundEnabled]);

  const handleOpenToastChat = (toast: ActiveToastNotification) => {
    // Dismiss toast
    setToasts(prev => prev.filter(t => t.id !== toast.id));
    navigate("/messages");
  };

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "70px",
        right: "24px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              pointerEvents: "auto",
              width: "360px",
              background: "rgba(17, 24, 39, 0.95)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(251, 146, 60, 0.35)",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4), 0 0 15px rgba(249, 115, 22, 0.2)",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              cursor: "pointer",
            }}
            onClick={() => handleOpenToastChat(toast)}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: toast.senderAvatarBg,
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "11px",
                  }}
                >
                  {toast.senderName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <strong style={{ fontSize: "12.5px", color: "#FFFFFF" }}>{toast.senderName}</strong>
                    <span style={{ fontSize: "9.5px", padding: "1px 5px", borderRadius: "3px", background: "rgba(255, 255, 255, 0.1)", color: "#94A3B8" }}>
                      {toast.senderRole.split("·")[0]}
                    </span>
                  </div>
                  <span style={{ fontSize: "10.5px", color: "#FDBA74", display: "flex", alignItems: "center", gap: "3px" }}>
                    <MessageSquare size={10} />
                    {toast.channelId ? "Channel Message" : "Direct Message"} · {toast.timestamp}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }} onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94A3B8",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                  }}
                  onClick={() => setSoundEnabled(v => !v)}
                  title={soundEnabled ? "Mute alert chime" : "Unmute alert chime"}
                >
                  {soundEnabled ? <Volume2 size={13} style={{ color: "#FB923C" }} /> : <VolumeX size={13} />}
                </button>

                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94A3B8",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                  }}
                  onClick={() => handleDismissToast(toast.id)}
                  title="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Message Body Preview */}
            <div
              style={{
                fontSize: "12.5px",
                color: "#E2E8F0",
                lineHeight: 1.4,
                background: "rgba(255, 255, 255, 0.04)",
                padding: "8px 10px",
                borderRadius: "6px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              "{toast.content}"
            </div>

            {/* Action Bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#94A3B8", paddingTop: "2px" }}>
              <span>Click notification to reply</span>
              <span style={{ color: "#FDBA74", fontWeight: 600 }}>Open Chat →</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default GlobalMessageNotifier;
