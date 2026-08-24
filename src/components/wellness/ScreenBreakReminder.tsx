import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Award,
  Bell,
  CheckCircle2,
  Clock,
  Coffee,
  Eye,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HrmsService } from "../../services/hrmsService";

// Config constants
const WORK_LIMIT_SECONDS = 60 * 60; // 60 minutes
const BREAK_LIMIT_SECONDS = 5 * 60; // 5 minutes
const SNOOZE_SECONDS = 5 * 60; // 5 minutes
const IDLE_TIMEOUT_SECONDS = 3 * 60; // 3 minutes without mouse/keyboard -> pause timer

export function ScreenBreakReminder() {
  // Active work seconds (counts up to 60 mins)
  const [activeSeconds, setActiveSeconds] = useState(0);
  // Break countdown seconds (counts down from 5 mins)
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(BREAK_LIMIT_SECONDS);
  // Modal states
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Guided breathing state (inhale 4s, hold 4s, exhale 4s)
  const [breathPhase, setBreathPhase] = useState<"Inhale" | "Hold" | "Exhale">("Inhale");

  const lastInteractionRef = useRef(Date.now());
  const timerRef = useRef<any>(null);
  const activeBreakIdRef = useRef<string | null>(null);
  const breakSourceRef = useRef<"AUTOMATIC" | "MANUAL">("MANUAL");

  // Listen to user interactions to detect active screen time
  useEffect(() => {
    const handleInteraction = () => {
      lastInteractionRef.current = Date.now();
      if (isIdle) setIsIdle(false);
    };

    window.addEventListener("mousemove", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleInteraction, { passive: true });
    window.addEventListener("click", handleInteraction, { passive: true });
    window.addEventListener("scroll", handleInteraction, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("scroll", handleInteraction);
    };
  }, [isIdle]);

  // Main 1-second interval loop
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const idleTime = (now - lastInteractionRef.current) / 1000;

      // If user is away from keyboard for > 3 minutes, pause work time
      if (idleTime > IDLE_TIMEOUT_SECONDS) {
        setIsIdle(true);
        return;
      }

      if (isBreakActive) {
        // Counting down the 5-minute break
        setBreakSecondsLeft(prev => {
          if (prev <= 1) {
            handleCompleteBreak();
            return BREAK_LIMIT_SECONDS;
          }
          return prev - 1;
        });
      } else if (!showPromptModal) {
        // Counting up 30 minutes of work
        setActiveSeconds(prev => {
          const next = prev + 1;
          if (next >= WORK_LIMIT_SECONDS) {
            triggerBreakPrompt("AUTOMATIC");
            return 0;
          }
          return next;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isBreakActive, showPromptModal]);

  // Breathing cycle animation (12 seconds total: 4s inhale, 4s hold, 4s exhale)
  useEffect(() => {
    if (!isBreakActive) return;
    const interval = setInterval(() => {
      setBreathPhase(curr => {
        if (curr === "Inhale") return "Hold";
        if (curr === "Hold") return "Exhale";
        return "Inhale";
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [isBreakActive]);

  const triggerBreakPrompt = (source: "AUTOMATIC" | "MANUAL" = "MANUAL") => {
    breakSourceRef.current = source;
    setShowPromptModal(true);
    // Play gentle chime sound if enabled
    if (soundEnabled) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      } catch (e) {
        // AudioContext not allowed before user gesture
      }
    }
  };

  const handleStartBreak = async () => {
    setShowPromptModal(false);
    setIsBreakActive(true);
    setBreakSecondsLeft(BREAK_LIMIT_SECONDS);
    try { activeBreakIdRef.current = await HrmsService.startWorkBreak(breakSourceRef.current); } catch { activeBreakIdRef.current = null; }
  };

  const handleSnooze = (mins = 5) => {
    setShowPromptModal(false);
    // Set timer so next prompt triggers in 5 mins
    setActiveSeconds(WORK_LIMIT_SECONDS - mins * 60);
  };

  const handleDismissGotIt = () => {
    setShowPromptModal(false);
    setActiveSeconds(0);
  };

  const handleCompleteBreak = async () => {
    const breakId = activeBreakIdRef.current;
    activeBreakIdRef.current = null;
    if (breakId) { try { await HrmsService.completeWorkBreak(breakId); } catch { /* The timer must still resume if audit sync fails. */ } }
    setIsBreakActive(false);
    setActiveSeconds(0);
    setBreakSecondsLeft(BREAK_LIMIT_SECONDS);
  };

  // Helper formatting mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const minutesWorked = Math.floor(activeSeconds / 60);
  const minutesUntilNext = Math.max(0, Math.ceil((WORK_LIMIT_SECONDS - activeSeconds) / 60));

  return (
    <>
      {/* 1. TOPBAR WELLNESS STATUS BADGE */}
      <div
        className="wellness-topbar-pill"
        title={`Screen Time: ${minutesWorked}m active • Next 5-min break in ${minutesUntilNext}m. Click to test reminder.`}
        onClick={() => triggerBreakPrompt("MANUAL")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          borderRadius: "20px",
          background: activeSeconds > 55 * 60 ? "var(--danger-soft, #FEF2F2)" : "var(--bg-card-subtle)",
          border: activeSeconds > 55 * 60 ? "1px solid var(--danger, #DC2626)" : "1px solid var(--border-subtle)",
          color: activeSeconds > 55 * 60 ? "var(--danger, #DC2626)" : "var(--text-muted)",
          fontSize: "11.5px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s ease",
          userSelect: "none",
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: isIdle ? "#94A3B8" : activeSeconds > 55 * 60 ? "#DC2626" : "#10B981",
            display: "inline-block",
            boxShadow: activeSeconds > 55 * 60 ? "0 0 6px rgba(220, 38, 38, 0.6)" : "none",
          }}
        />
        <Coffee size={13} />
        <span>{minutesWorked}m active</span>
        <small style={{ opacity: 0.75, fontSize: "10px" }}>(Break in {minutesUntilNext}m)</small>
      </div>

      {/* 2. EVEREST-STYLE SCREEN TIME REMINDER PROMPT (Matching User Photo) */}
      <AnimatePresence>
        {showPromptModal && (
          <div
            className="modal-backdrop-clean"
            style={{
              background: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(5px)",
              zIndex: 2000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              style={{
                width: "min(520px, 100%)",
                background: "#FFFFFF",
                borderRadius: "20px",
                border: "2px solid #E11D48",
                boxShadow: "0 25px 60px -12px rgba(225, 29, 72, 0.25), 0 12px 30px rgba(0, 0, 0, 0.2)",
                padding: "36px 32px 28px",
                textAlign: "center",
                color: "#1E293B",
                position: "relative",
                fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
              }}
            >
              {/* Header Label */}
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "20px",
                  letterSpacing: "0.2px",
                }}
              >
                Screen Time Reminder
              </div>

              {/* AECS Official Red/Navy Emblem Box (Matching Photo) */}
              <div
                style={{
                  background: "linear-gradient(135deg, #A8071A 0%, #E11D48 100%)",
                  borderRadius: "10px",
                  padding: "16px 20px",
                  color: "#FFFFFF",
                  maxWidth: "340px",
                  margin: "0 auto 24px",
                  boxShadow: "0 8px 20px rgba(225, 29, 72, 0.25)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "4px" }}>
                  <img
                    src="/abroad-logo-new.png"
                    alt="AECS"
                    style={{ height: "28px", width: "auto", filter: "brightness(0) invert(1)" }}
                  />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.5px", lineHeight: 1.1 }}>
                      ABROAD EDUCATION
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: 600, opacity: 0.9 }}>
                      CONSULTANCY SERVICES
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 600,
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    marginTop: "6px",
                    paddingTop: "6px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.25)",
                    opacity: 0.9,
                  }}
                >
                  Consistent • Strong • Dependable
                </div>
              </div>

              {/* Big Red Title */}
              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#E11D48",
                  margin: "0 0 12px",
                }}
              >
                Time to take a break!
              </h2>

              {/* Description Copy (Matching Photo) */}
              <p
                style={{
                  fontSize: "13.5px",
                  lineHeight: 1.6,
                  color: "#334155",
                  maxWidth: "420px",
                  margin: "0 auto 16px",
                }}
              >
                You've been active for <strong>60 minutes</strong> continuously. Look away from the screen, stretch, rest your eyes, and have a glass of water.
              </p>

              {/* Department Signature (Matching Photo) */}
              <div
                style={{
                  fontSize: "12px",
                  fontStyle: "italic",
                  color: "#64748B",
                  marginBottom: "28px",
                }}
              >
                HR Department & Employee Ergonomics
              </div>

              {/* Action Buttons (Matching Photo) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={handleStartBreak}
                  style={{
                    background: "linear-gradient(135deg, #E11D48 0%, #BE123C 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(225, 29, 72, 0.35)",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Coffee size={16} />
                  <span>Take 5-Min Break</span>
                </button>

                <button
                  type="button"
                  onClick={handleDismissGotIt}
                  style={{
                    background: "#E2E8F0",
                    color: "#1E293B",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Got It!
                </button>

                <button
                  type="button"
                  onClick={() => handleSnooze(5)}
                  style={{
                    background: "#F1F5F9",
                    color: "#475569",
                    border: "1px solid #CBD5E1",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Snooze (5 mins)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. RELAXING 5-MINUTE BREAK MODE OVERLAY */}
      <AnimatePresence>
        {isBreakActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
              color: "#FFFFFF",
              zIndex: 3000,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <div style={{ maxWidth: "600px", width: "100%" }}>
              {/* Wellness Badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 16px",
                  borderRadius: "20px",
                  background: "rgba(225, 29, 72, 0.15)",
                  border: "1px solid rgba(225, 29, 72, 0.4)",
                  color: "#FDA4AF",
                  fontSize: "12px",
                  fontWeight: 700,
                  marginBottom: "20px",
                  letterSpacing: "0.5px",
                }}
              >
                <Sparkles size={14} />
                <span>5-MINUTE ERGONOMIC REFRESH</span>
              </div>

              <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 10px", color: "#FFFFFF" }}>
                Rest Your Eyes & Recharge
              </h1>
              <p style={{ fontSize: "14px", color: "#94A3B8", margin: "0 0 32px" }}>
                Take this time away from screens. Follow the 20-20-20 rule, breathe deeply, and hydrate.
              </p>

              {/* Big Circular Countdown Timer */}
              <div style={{ position: "relative", width: "200px", height: "200px", margin: "0 auto 32px" }}>
                <svg width="200" height="200" style={{ transform: "rotate(-90deg)" }}>
                  <circle
                    cx="100"
                    cy="100"
                    r="88"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="88"
                    stroke="#E11D48"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 88}
                    strokeDashoffset={
                      2 * Math.PI * 88 * (1 - breakSecondsLeft / BREAK_LIMIT_SECONDS)
                    }
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>

                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: "36px", fontWeight: 800, fontFamily: "var(--font-mono)", color: "#FFFFFF" }}>
                    {formatTime(breakSecondsLeft)}
                  </span>
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#FDA4AF", fontWeight: 600 }}>
                    Remaining
                  </span>
                </div>
              </div>

              {/* Guided Breathing Circle */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "16px",
                  padding: "18px 24px",
                  marginBottom: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <span style={{ fontSize: "11px", textTransform: "uppercase", color: "#94A3B8", fontWeight: 700 }}>
                    Guided Breathing
                  </span>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#38BDF8", marginTop: "2px" }}>
                    {breathPhase}...
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", textTransform: "uppercase", color: "#94A3B8", fontWeight: 700 }}>
                    Ergonomic Tip
                  </span>
                  <div style={{ fontSize: "12.5px", color: "#E2E8F0", marginTop: "2px" }}>
                    Look 20 feet away to relax eye muscles
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: "flex", justifyContent: "center", gap: "14px" }}>
                <button
                  type="button"
                  onClick={handleCompleteBreak}
                  style={{
                    background: "rgba(255, 255, 255, 0.12)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Finish Break & Resume CRM</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ScreenBreakReminder;
