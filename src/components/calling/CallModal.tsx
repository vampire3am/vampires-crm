import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CameraOff,
  ChevronRight,
  ExternalLink,
  Info,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Phone,
  PhoneOff,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  User,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ActiveCallSession,
  type CallStatus,
  CallingService,
  ringtones,
} from "../../services/callingService";
import { type StaffUser } from "../../services/messagingService";

interface CallModalProps {
  session: ActiveCallSession;
  currentUserId: string;
  onClose: () => void;
}

export function CallModal({ session, currentUserId, onClose }: CallModalProps) {
  const isCaller = session.callerId === currentUserId;
  const otherPartyId = isCaller ? session.recipientId : session.callerId;

  // Active logged-in staff member
  const currentStaff = useMemo(() => {
    return {
        id: currentUserId,
        fullName: "AECS Staff",
        role: "Staff Member",
        department: "Operations",
        presence: "ONLINE",
        avatarBg: "#F97316",
        phone: "+977 9801980000",
        email: "staff@aecsnepal.com",
      };
  }, [currentUserId]);

  // Working profile of the other staff member
  const otherStaff: StaffUser = useMemo(() => {
    return {
        id: otherPartyId,
        fullName: isCaller ? session.recipientName : session.callerName,
        role: isCaller ? session.recipientRole : session.callerRole,
        department: "Management",
        presence: "ONLINE",
        avatarBg: isCaller ? session.recipientAvatarBg : session.callerAvatarBg,
        phone: "+977 9841230000",
        email: "staff@aecsnepal.com",
      };
  }, [otherPartyId, isCaller, session]);

  const [callStatus, setCallStatus] = useState<CallStatus>(session.status);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(session.callType === "audio");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; time: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Attach remote stream to HTML media elements
  const attachRemoteStream = (stream: MediaStream) => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.play().catch(e => console.warn("Audio autoplay:", e));
    }
    if (remoteVideoRef.current && session.callType === "video") {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(e => console.warn("Video autoplay:", e));
    }
  };

  // Initialize and attach video streams
  useEffect(() => {
    CallingService.setVoiceLevelCallback(lvl => {
      setAudioLevel(lvl);
    });

    if (CallingService.remoteStream) {
      attachRemoteStream(CallingService.remoteStream);
    }
    if (CallingService.localStream && localVideoRef.current && session.callType === "video") {
      localVideoRef.current.srcObject = CallingService.localStream;
    }

    return () => {
      CallingService.setVoiceLevelCallback(null);
    };
  }, []);

  // Poll for call status, remote SDP answer, and ICE candidates
  useEffect(() => {
    let isCancelled = false;

    const handleSync = async () => {
      try {
        const res = await fetch("/api/sync/call/status");
        if (res.ok) {
          const activeCalls = await res.json();
          const current: ActiveCallSession = activeCalls[session.callId];
          if (current) {
            if (current.status === "CONNECTED" && callStatus !== "CONNECTED") {
              ringtones.stop();
              setCallStatus("CONNECTED");

              if (isCaller && current.answer) {
                await CallingService.handleRemoteAnswer(current.answer);
              }
            }

            if (current.candidates && current.candidates.length > 0) {
              for (const item of current.candidates) {
                if (item.targetId === currentUserId) {
                  await CallingService.handleRemoteCandidate(item.candidate);
                }
              }
            }

            if (CallingService.remoteStream && !remoteAudioRef.current?.srcObject) {
              attachRemoteStream(CallingService.remoteStream);
            }
          } else {
            if (!isCancelled) {
              ringtones.stop();
              onClose();
            }
          }
        }
      } catch {}
    };

    const interval = setInterval(handleSync, 1000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [session.callId, callStatus, isCaller, currentUserId, onClose]);

  // Duration timer once connected
  useEffect(() => {
    let timer: any = null;
    if (callStatus === "CONNECTED") {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleToggleMic = () => {
    const next = !isMuted;
    setIsMuted(next);
    CallingService.setAudioEnabled(!next);
  };

  const handleToggleVideo = () => {
    const next = !isVideoOff;
    setIsVideoOff(next);
    CallingService.setVideoEnabled(!next);
  };

  const handleToggleScreenShare = async () => {
    if (!isScreenSharing) {
      const stream = await CallingService.startScreenShare();
      if (stream) {
        setIsScreenSharing(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }
    } else {
      await CallingService.stopScreenShare();
      setIsScreenSharing(false);
      if (localVideoRef.current && CallingService.localStream) {
        localVideoRef.current.srcObject = CallingService.localStream;
      }
    }
  };

  const handleSendInCallMessage = () => {
    if (!chatInput.trim()) return;
    const newMsg = {
      sender: currentStaff.fullName,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput("");
  };

  const handleHangUp = async () => {
    ringtones.stop();
    await CallingService.endCall(session.callId, currentUserId, "ended", duration);
    onClose();
  };

  if (isMinimized) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "290px",
          background: "#0F172A",
          border: "2px solid #FB923C",
          borderRadius: "14px",
          padding: "12px 14px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#FFFFFF",
        }}
      >
        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: otherStaff.avatarBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            {otherStaff.fullName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <strong style={{ fontSize: "13px", display: "block" }}>{otherStaff.fullName}</strong>
            <span style={{ fontSize: "11px", color: "#FDBA74", fontFamily: "monospace" }}>
              {callStatus === "RINGING" ? "Ringing…" : `Live Call · ${formatTimer(duration)}`}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="messenger-icon-btn"
            onClick={() => setIsMinimized(false)}
            title="Maximize Call Window"
          >
            <Maximize2 size={14} />
          </button>
          <button
            type="button"
            style={{
              background: "#EF4444",
              border: "none",
              borderRadius: "50%",
              width: "30px",
              height: "30px",
              color: "#FFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onClick={handleHangUp}
            title="Hang Up"
          >
            <PhoneOff size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="call-modal-backdrop">
      {/* Hidden Live Voice Audio Player with Autoplay */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="call-modal-container"
      >
        {/* Header Bar */}
        <div className="call-header-bar">
          <div className="call-header-left">
            <div className="call-type-badge">
              {session.callType === "audio" ? <Phone size={13} /> : <Video size={13} />}
              <span>AECS Enterprise HD Conference</span>
            </div>
            <span style={{ fontSize: "11.5px", color: "#10B981", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10B981" }} />
              256-Bit Encrypted P2P
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="call-timer">
              <span>●</span>
              <span>{callStatus === "RINGING" ? "Calling…" : formatTimer(duration)}</span>
            </div>

            {/* View Profile Drawer Toggle */}
            <button
              type="button"
              className="messenger-icon-btn"
              onClick={() => {
                setShowProfileDrawer(v => !v);
                setShowChatDrawer(false);
              }}
              title="Staff Profile Info"
              style={{ color: showProfileDrawer ? "#FB923C" : "#94A3B8" }}
            >
              <Info size={16} />
            </button>

            {/* Minimize to PiP */}
            <button
              type="button"
              className="messenger-icon-btn"
              onClick={() => setIsMinimized(true)}
              title="Minimize to Picture-in-Picture"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Meeting Stage Area */}
        <div className="call-stage-area">
          {callStatus === "RINGING" ? (
            /* Ringing Screen while waiting for colleague to pick up */
            <div className="call-profile-stage">
              <div
                className="call-avatar-pulse ringing"
                style={{ background: otherStaff.avatarBg }}
              >
                {otherStaff.fullName.substring(0, 2).toUpperCase()}
              </div>

              <h2 className="call-user-name">{otherStaff.fullName}</h2>
              <span className="call-user-role">{otherStaff.role}</span>
              <div className="call-user-dept">
                🏢 {otherStaff.department} · 📞 {otherStaff.phone || "+977 9841230000"}
              </div>

              <div style={{ marginTop: "16px", fontSize: "13px", color: "#F59E0B", fontWeight: 600 }}>
                Ringing colleague on Kathmandu LAN…
              </div>

              {/* Ringing Cancel Button */}
              <div style={{ marginTop: "24px" }}>
                <button
                  type="button"
                  className="call-btn call-btn-hangup"
                  style={{ width: "52px", height: "52px", borderRadius: "50%", padding: 0 }}
                  onClick={handleHangUp}
                  title="Cancel Call"
                >
                  <PhoneOff size={22} />
                </button>
              </div>
            </div>
          ) : (
            /* Connected: Native Dual-Grid Zoom-grade Conference Stage */
            <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* Remote Video Track (if camera active) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: session.callType === "video" && !isVideoOff ? "block" : "none",
                }}
              />

              {/* Avatar Stage (Audio Call or Video off) */}
              <div
                className="call-profile-stage"
                style={{
                  display: session.callType === "video" && !isVideoOff ? "none" : "flex",
                }}
              >
                <div
                  className="call-avatar-pulse"
                  style={{
                    background: otherStaff.avatarBg,
                    transform: `scale(${1 + Math.min(0.2, audioLevel / 120)})`,
                    boxShadow: audioLevel > 15 ? `0 0 35px ${otherStaff.avatarBg}` : "0 10px 30px rgba(0,0,0,0.5)",
                    transition: "transform 0.08s ease, box-shadow 0.08s ease",
                  }}
                >
                  {otherStaff.fullName.substring(0, 2).toUpperCase()}
                </div>

                <h2 className="call-user-name">{otherStaff.fullName}</h2>
                <span className="call-user-role">{otherStaff.role}</span>
                <div className="call-user-dept">
                  🏢 {otherStaff.department} · 📞 {otherStaff.phone || "+977 9801980003"}
                </div>

                {/* In-Call Status Banner */}
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#10B981", fontWeight: 600 }}>
                  Live 2-Way High Fidelity Audio Stream Connected
                </div>

                {/* Real-time Voice Wave Visualizer */}
                <div className="audio-waves-container">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(i => {
                    const barHeight = Math.max(8, (audioLevel / 1.8) * Math.sin((i / 15) * Math.PI) + (audioLevel > 10 ? 12 : 6));
                    return (
                      <div
                        key={i}
                        className="audio-wave-bar"
                        style={{
                          height: `${barHeight}px`,
                          background: isMuted ? "#64748B" : "#FB923C",
                          opacity: audioLevel > 5 ? 1 : 0.45,
                          transition: "height 0.08s ease",
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Local PiP Video Preview */}
              {session.callType === "video" && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "16px",
                    right: "16px",
                    width: "180px",
                    height: "120px",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: "2px solid rgba(251, 146, 60, 0.5)",
                    background: "#1E293B",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
                    zIndex: 10,
                  }}
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "4px",
                      left: "6px",
                      fontSize: "10px",
                      background: "rgba(0,0,0,0.6)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      color: "#FFF",
                    }}
                  >
                    You {isMuted ? "(Muted)" : ""}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Collapsible Staff Working Profile Drawer */}
          {showProfileDrawer && (
            <div
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                width: "290px",
                background: "rgba(15, 23, 42, 0.96)",
                backdropFilter: "blur(14px)",
                border: "1px solid rgba(251, 146, 60, 0.35)",
                borderRadius: "14px",
                padding: "16px",
                boxShadow: "0 15px 35px rgba(0,0,0,0.7)",
                zIndex: 20,
                color: "#FFFFFF",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <strong style={{ fontSize: "13px", color: "#FDBA74" }}>Staff Working Profile</strong>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
                  onClick={() => setShowProfileDrawer(false)}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: otherStaff.avatarBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "15px",
                  }}
                >
                  {otherStaff.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <strong style={{ fontSize: "14px", display: "block" }}>{otherStaff.fullName}</strong>
                  <span style={{ fontSize: "11.5px", color: "#94A3B8" }}>{otherStaff.role}</span>
                </div>
              </div>

              <div style={{ fontSize: "12px", color: "#CBD5E1", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div><strong>🏢 Department:</strong> {otherStaff.department}</div>
                <div><strong>📞 Direct Phone:</strong> {otherStaff.phone || "+977 9801980003"}</div>
                <div><strong>📧 Email:</strong> {otherStaff.email}</div>
                <div><strong>📍 Location:</strong> Adwait Marga, Purano Buspark, Bagbazar</div>
                <div><strong>🔒 Connection:</strong> Direct Encrypted WebRTC</div>
              </div>
            </div>
          )}

          {/* In-Call Live Chat Drawer */}
          {showChatDrawer && (
            <div
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                width: "300px",
                height: "400px",
                background: "rgba(15, 23, 42, 0.96)",
                backdropFilter: "blur(14px)",
                border: "1px solid rgba(251, 146, 60, 0.35)",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 15px 35px rgba(0,0,0,0.7)",
                zIndex: 20,
                color: "#FFFFFF",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ fontSize: "13px", color: "#FDBA74" }}>In-Meeting Chat</strong>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
                  onClick={() => setShowChatDrawer(false)}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {chatMessages.length === 0 ? (
                  <span style={{ fontSize: "12px", color: "#64748B", textAlign: "center", marginTop: "40px" }}>
                    No messages yet in this call.
                  </span>
                ) : (
                  chatMessages.map((m, idx) => (
                    <div key={idx} style={{ background: "rgba(255,255,255,0.06)", padding: "8px 10px", borderRadius: "8px", fontSize: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#94A3B8", fontSize: "10.5px", marginBottom: "2px" }}>
                        <strong>{m.sender}</strong>
                        <span>{m.time}</span>
                      </div>
                      <div>{m.text}</div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ padding: "8px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendInCallMessage()}
                  placeholder="Send a note…"
                  style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "6px 10px", color: "#FFF", fontSize: "12px", outline: "none" }}
                />
                <button
                  type="button"
                  onClick={handleSendInCallMessage}
                  style={{ background: "#F97316", border: "none", borderRadius: "6px", color: "#FFF", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Zoom In-Call Toolbar */}
        <div className="call-controls-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Mute Microphone */}
            <button
              type="button"
              className={`call-btn call-btn-control ${isMuted ? "active-off" : ""}`}
              onClick={handleToggleMic}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              <span>{isMuted ? "Unmute" : "Mute"}</span>
            </button>

            {/* Camera Toggle */}
            {session.callType === "video" && (
              <button
                type="button"
                className={`call-btn call-btn-control ${isVideoOff ? "active-off" : ""}`}
                onClick={handleToggleVideo}
                title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
              >
                {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
                <span>{isVideoOff ? "Start Video" : "Stop Video"}</span>
              </button>
            )}

            {/* Screen Share */}
            <button
              type="button"
              className={`call-btn call-btn-control ${isScreenSharing ? "active-off" : ""}`}
              onClick={handleToggleScreenShare}
              title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
            >
              <MonitorUp size={16} />
              <span>{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* In-Call Chat Drawer Toggle */}
            <button
              type="button"
              className={`call-btn call-btn-control ${showChatDrawer ? "active-off" : ""}`}
              onClick={() => {
                setShowChatDrawer(v => !v);
                setShowProfileDrawer(false);
              }}
              title="Open In-Call Chat"
            >
              <span>Chat</span>
            </button>

            {/* Hang Up Button */}
            <button
              type="button"
              className="call-btn call-btn-hangup"
              onClick={handleHangUp}
              title="End / Leave Call"
            >
              <PhoneOff size={16} />
              <span>Leave</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default CallModal;
