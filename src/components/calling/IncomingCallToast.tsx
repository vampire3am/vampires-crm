import { AnimatePresence, motion } from "framer-motion";
import { Phone, PhoneCall, PhoneOff, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../features/auth/AuthProvider";
import {
  type ActiveCallSession,
  CallingService,
  ringtones,
} from "../../services/callingService";
import { CallModal } from "./CallModal";

export function IncomingCallToast() {
  const { profile } = useAuth();
  const [incomingCall, setIncomingCall] = useState<ActiveCallSession | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveCallSession | null>(null);

  const currentStaffId = profile?.id ?? "pending-session";

  // Check for incoming call signals on server
  const checkCalls = async () => {
    try {
      const res = await fetch("/api/sync/call/status");
      if (res.ok) {
        const activeCalls: Record<string, ActiveCallSession> = await res.json();
        const callKeys = Object.keys(activeCalls);

        for (const key of callKeys) {
          const call = activeCalls[key];
          // If I am the recipient of an incoming ringing call
          if (call.recipientId === currentStaffId && call.status === "RINGING") {
            if (!incomingCall && !activeSession) {
              setIncomingCall(call);
              ringtones.playIncomingRing();
            }
            return;
          }

          // If I am currently in a connected session
          if (
            (call.callerId === currentStaffId || call.recipientId === currentStaffId) &&
            call.status === "CONNECTED"
          ) {
            if (!activeSession) {
              setActiveSession(call);
              setIncomingCall(null);
              ringtones.stop();
            }
            return;
          }
        }

        // If no call exists for me, stop ringing
        if (incomingCall && !callKeys.some(k => activeCalls[k]?.callId === incomingCall.callId)) {
          setIncomingCall(null);
          ringtones.stop();
        }
      }
    } catch {}
  };

  useEffect(() => {
    const interval = setInterval(checkCalls, 1500);
    return () => {
      clearInterval(interval);
      ringtones.stop();
    };
  }, [currentStaffId, incomingCall, activeSession]);

  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    ringtones.stop();
    await CallingService.answerCall(incomingCall, currentStaffId);
    setActiveSession({
      ...incomingCall,
      status: "CONNECTED",
    });
    setIncomingCall(null);
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    ringtones.stop();
    await CallingService.endCall(incomingCall.callId, currentStaffId, "declined");
    setIncomingCall(null);
  };

  return (
    <>
      {/* 1. Incoming Call Notification Toast */}
      <AnimatePresence>
        {incomingCall && !activeSession && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="incoming-call-toast"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: incomingCall.callerAvatarBg || "#FB923C",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "18px",
                  flexShrink: 0,
                  boxShadow: "0 0 15px rgba(251, 146, 60, 0.5)",
                }}
              >
                {incomingCall.callerName.substring(0, 2).toUpperCase()}
              </div>

              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <strong style={{ fontSize: "14px", color: "#FFFFFF" }}>{incomingCall.callerName}</strong>
                </div>
                <span style={{ fontSize: "11px", color: "#94A3B8", display: "block" }}>
                  {incomingCall.callerRole}
                </span>
                <span style={{ fontSize: "11.5px", color: "#FDBA74", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                  {incomingCall.callType === "audio" ? <PhoneCall size={12} /> : <Video size={12} />}
                  Incoming {incomingCall.callType === "audio" ? "Voice Call…" : "HD Video Call…"}
                </span>
              </div>
            </div>

            {/* Accept & Decline Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                className="call-btn call-btn-accept"
                style={{ flex: 1, height: "42px", borderRadius: "10px", gap: "6px", fontSize: "13px", fontWeight: 700 }}
                onClick={handleAcceptCall}
              >
                <Phone size={16} />
                <span>Accept</span>
              </button>

              <button
                type="button"
                className="call-btn call-btn-hangup"
                style={{ flex: 1, height: "42px", borderRadius: "10px", gap: "6px", fontSize: "13px", fontWeight: 700 }}
                onClick={handleDeclineCall}
              >
                <PhoneOff size={16} />
                <span>Decline</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Active In-Call Modal */}
      {activeSession && (
        <CallModal
          session={activeSession}
          currentUserId={currentStaffId}
          onClose={() => {
            setActiveSession(null);
            ringtones.stop();
          }}
        />
      )}
    </>
  );
}

export default IncomingCallToast;
