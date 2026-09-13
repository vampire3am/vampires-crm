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

let messageAudioContext:AudioContext|null=null;
const getMessageAudioContext=()=>{const AudioContextClass=window.AudioContext||(window as any).webkitAudioContext;if(!AudioContextClass)return null;messageAudioContext??=new AudioContextClass();return messageAudioContext};

export async function unlockMessageAudio(){
  const ctx=getMessageAudioContext();if(!ctx)return false;
  if(ctx.state==="suspended")await ctx.resume();
  const oscillator=ctx.createOscillator(),gain=ctx.createGain();gain.gain.value=.0001;oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.01);
  return ctx.state==="running";
}

// Loud, distinctive three-note alert, played by an audio context unlocked by a user gesture.
export function playChimeNotification() {
  try {
    const ctx=getMessageAudioContext();
    if(!ctx||ctx.state!=="running")return;
    const now = ctx.currentTime;
    [{frequency:659.25,offset:0,duration:.22,volume:.34},{frequency:880,offset:.14,duration:.3,volume:.38},{frequency:1046.5,offset:.32,duration:.45,volume:.42}].forEach(note=>{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type="sine";oscillator.frequency.setValueAtTime(note.frequency,now+note.offset);gain.gain.setValueAtTime(note.volume,now+note.offset);gain.gain.exponentialRampToValueAtTime(.001,now+note.offset+note.duration);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(now+note.offset);oscillator.stop(now+note.offset+note.duration);
    });
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
  const knownMessageIds = useRef(new Set<string>());
  const isFirstLoad = useRef(true);

  // Current logged in staff ID
  const currentStaffId = profile?.id ?? "pending-session";

  const checkForNewMessages = async () => {
    try {
      const allMsgs = await MessagingService.getMessages();
      if (!allMsgs) return;
      if(allMsgs.length===0){isFirstLoad.current=false;return}

      // The first snapshot establishes the baseline. Later snapshots process every
      // unseen row, so bursts and realtime/polling races cannot lose notifications.
      if (isFirstLoad.current) {
        allMsgs.forEach(message=>knownMessageIds.current.add(message.id));
        isFirstLoad.current = false;
        return;
      }
      const unseen=allMsgs.filter(message=>!knownMessageIds.current.has(message.id));
      allMsgs.forEach(message=>knownMessageIds.current.add(message.id));
      for(const latestMsg of unseen){
        if(latestMsg.senderId===currentStaffId)continue;
        if(latestMsg.recipientId&&latestMsg.recipientId!==currentStaffId)continue;

        // Play Sound
        if (soundEnabled) {
          playChimeNotification();
        }

        if("Notification" in window&&Notification.permission==="granted"&&document.hidden){
          const desktopAlert=new Notification(`${latestMsg.senderName} · CRM message`,{body:latestMsg.content||"Sent an attachment",tag:`crm-message-${latestMsg.id}`});
          desktopAlert.onclick=()=>{window.focus();navigate("/messages");desktopAlert.close()};
        }
        if(document.hidden)document.title=`New message from ${latestMsg.senderName} · AECS CRM`;

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
    const unlock=()=>{void unlockMessageAudio()};
    window.addEventListener("pointerdown",unlock,{once:true});
    window.addEventListener("keydown",unlock,{once:true});
    // Initial fetch
    checkForNewMessages();

    // Subscribe to live SSE events across LAN
    const unsubscribe = MessagingService.subscribeToSyncEvents(checkForNewMessages);

    // Fast polling fallback (every 2.5s)
    const interval = setInterval(checkForNewMessages, 2500);

    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener("pointerdown",unlock);
      window.removeEventListener("keydown",unlock);
      document.title="Abroad Education Consultancy Services";
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
