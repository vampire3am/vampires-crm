import { type StaffUser } from "./messagingService";
import { getGuitarNokiaRingtoneAudio } from "../utils/guitarNokiaRingtone";

export type CallType = "audio" | "video";
export type CallStatus = "RINGING" | "CONNECTED" | "ENDED" | "DECLINED" | "BUSY";

export interface ActiveCallSession {
  callId: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  callerAvatarBg: string;
  recipientId: string;
  recipientName: string;
  recipientRole: string;
  recipientAvatarBg: string;
  callType: CallType;
  status: CallStatus;
  startedAt: number;
  answeredAt?: number;
  offer?: any;
  answer?: any;
  candidates?: any[];
}

export const RTC_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
  ],
  iceCandidatePoolSize: 10,
};

// Global AudioContext for crystal-clear Web Audio playback
let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Auto-unlock audio on user click or touch anywhere on the page
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    const ringAudio = getGuitarNokiaRingtoneAudio();
    if (ringAudio) {
      ringAudio.load();
    }
  };
  window.addEventListener("click", unlockAudio, { once: false });
  window.addEventListener("keydown", unlockAudio, { once: false });
  window.addEventListener("touchstart", unlockAudio, { once: false });
}

// Sound Synthesizer for Outgoing and Incoming Ringing
class CallRingtoneManager {
  private timer: any = null;
  private isPlaying = false;

  // Incoming Call Ringing (Guitar Nokia Ringtone - Gran Vals - Infinite Universal Loop)
  playIncomingRing() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // 1. Play continuous background-capable HTML5 Guitar Nokia WAV Loop
    const guitarAudio = getGuitarNokiaRingtoneAudio();
    if (guitarAudio) {
      guitarAudio.currentTime = 0;
      guitarAudio.volume = 1.0;
      guitarAudio.play().catch(e => console.warn("Background guitar audio play:", e));
    }

    // 2. Synthesize High-Fidelity Spanish Guitar Nokia Tune in Web Audio (Continuous loop)
    const playGuitarMelody = () => {
      const ctx = getSharedAudioContext();
      if (!ctx || !this.isPlaying) return;

      const now = ctx.currentTime;
      // Acoustic Guitar Nokia Gran Vals Phrase
      const pattern = [
        { freq: 82.41,  time: 0.00, dur: 1.10, vol: 0.50 }, // E2 Bass
        { freq: 659.25, time: 0.00, dur: 0.26, vol: 0.40 }, // E5
        { freq: 587.33, time: 0.25, dur: 0.26, vol: 0.38 }, // D5
        { freq: 369.99, time: 0.50, dur: 0.35, vol: 0.35 }, // F#4
        { freq: 415.30, time: 0.82, dur: 0.38, vol: 0.38 }, // G#4
        { freq: 110.00, time: 1.15, dur: 1.10, vol: 0.50 }, // A2 Bass
        { freq: 554.37, time: 1.15, dur: 0.26, vol: 0.40 }, // C#5
        { freq: 493.88, time: 1.40, dur: 0.26, vol: 0.38 }, // B4
        { freq: 293.66, time: 1.65, dur: 0.35, vol: 0.35 }, // D4
        { freq: 329.63, time: 1.97, dur: 0.38, vol: 0.38 }, // E4
        { freq: 82.41,  time: 2.30, dur: 1.10, vol: 0.50 }, // E2 Bass
        { freq: 493.88, time: 2.30, dur: 0.26, vol: 0.40 }, // B4
        { freq: 440.00, time: 2.55, dur: 0.26, vol: 0.38 }, // A4
        { freq: 277.18, time: 2.80, dur: 0.35, vol: 0.35 }, // C#4
        { freq: 329.63, time: 3.12, dur: 0.38, vol: 0.38 }, // E4
        // Acoustic Guitar Final Strum (A Major Chord)
        { freq: 110.00, time: 3.45, dur: 0.70, vol: 0.45 }, // A2
        { freq: 220.00, time: 3.48, dur: 0.65, vol: 0.40 }, // A3
        { freq: 277.18, time: 3.50, dur: 0.65, vol: 0.40 }, // C#4
        { freq: 329.63, time: 3.52, dur: 0.65, vol: 0.42 }, // E4
        { freq: 440.00, time: 3.55, dur: 0.65, vol: 0.45 }, // A4
      ];

      pattern.forEach(({ freq, time, dur, vol }) => {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(freq, now + time);
        gain1.gain.setValueAtTime(vol, now + time);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now + time);
        osc1.stop(now + time + dur);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(freq * 2, now + time);
        gain2.gain.setValueAtTime(vol * 0.4, now + time);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + time + dur * 0.75);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + time);
        osc2.stop(now + time + dur * 0.75);
      });
    };

    playGuitarMelody();
    this.timer = setInterval(playGuitarMelody, 7000);
  }

  // Outgoing Call Ringback Tone (Classic smooth electronic double pulse)
  playOutgoingRingback() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    const playTone = () => {
      const ctx = getSharedAudioContext();
      if (!ctx || !this.isPlaying) return;

      const now = ctx.currentTime;

      // First pulse (440Hz + 480Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Second pulse
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(480, now + 0.18);
      gain2.gain.setValueAtTime(0.18, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.65);
    };

    playTone();
    this.timer = setInterval(playTone, 2500);
  }

  stop() {
    this.isPlaying = false;
    const guitarAudio = getGuitarNokiaRingtoneAudio();
    if (guitarAudio) {
      try {
        guitarAudio.pause();
        guitarAudio.currentTime = 0;
      } catch {}
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const ringtones = new CallRingtoneManager();

export class CallingService {
  public static localStream: MediaStream | null = null;
  public static remoteStream: MediaStream | null = null;
  public static peerConnection: RTCPeerConnection | null = null;
  private static mediaRecorder: MediaRecorder | null = null;
  private static eventSource: EventSource | null = null;
  private static onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private static onVoiceLevelCallback: ((level: number) => void) | null = null;
  private static processedIceCandidates = new Set<string>();
  private static currentCallId: string | null = null;
  private static currentTargetId: string | null = null;
  private static currentUserId: string | null = null;

  // Initialize WebRTC media stream
  static async getMediaStream(callType: CallType): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      getSharedAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      this.localStream = stream;
      return stream;
    } catch (err) {
      console.warn("Direct microphone request failed, creating virtual fallback stream:", err);
      try {
        const audioCtx = getSharedAudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        this.localStream = dest.stream;
        return dest.stream;
      } catch {
        const fallback = new MediaStream();
        this.localStream = fallback;
        return fallback;
      }
    }
  }

  // Start continuous 2-way Voice Streaming over LAN packet relay
  static startAudioRelay(callId: string, senderId: string, targetId: string, stream: MediaStream) {
    this.stopAudioRelay();
    this.currentCallId = callId;
    this.currentUserId = senderId;
    this.currentTargetId = targetId;

    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = async event => {
        if (event.data && event.data.size > 0 && this.currentCallId === callId) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Data = reader.result as string;
            if (base64Data) {
              fetch("/api/sync/call/audio-packet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callId,
                  senderId,
                  targetId,
                  audioBase64: base64Data,
                }),
              }).catch(() => {});
            }
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Emit audio packets every 300ms for continuous live voice
      recorder.start(300);
    } catch (err) {
      console.warn("Could not start MediaRecorder audio relay:", err);
    }

    this.listenForAudioPackets(senderId);
  }

  // Listen for live voice audio packets from other colleague
  private static listenForAudioPackets(currentUserId: string) {
    if (this.eventSource) return;

    try {
      const es = new EventSource("/api/sync/events");
      this.eventSource = es;

      es.addEventListener("call_audio_packet", async (e: MessageEvent) => {
        try {
          const packet = JSON.parse(e.data);
          if (packet.targetId === currentUserId && packet.callId === this.currentCallId) {
            this.playAudioPacket(packet.audioBase64);
          }
        } catch {}
      });
    } catch {}
  }

  // Play incoming audio slice via Web Audio API
  private static async playAudioPacket(base64Data: string) {
    try {
      const ctx = getSharedAudioContext();
      const base64Content = base64Data.split(",")[1];
      if (!base64Content) return;

      const binaryStr = atob(base64Content);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Connect to destination speakers
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.start();

      // Trigger volume meter for voice visualizer
      if (this.onVoiceLevelCallback) {
        const pcm = audioBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < pcm.length; i += 10) {
          sum += Math.abs(pcm[i]);
        }
        const avg = (sum / (pcm.length / 10)) * 100;
        this.onVoiceLevelCallback(Math.min(100, avg * 2));
      }
    } catch (err) {
      // Ignored for malformed chunks
    }
  }

  static stopAudioRelay() {
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== "inactive") {
          this.mediaRecorder.stop();
        }
      } catch {}
      this.mediaRecorder = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.currentCallId = null;
  }

  static setAudioEnabled(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  static setVideoEnabled(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  static async startScreenShare(): Promise<MediaStream | null> {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const videoTrack = displayStream.getVideoTracks()[0];
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
      videoTrack.onended = () => {
        this.stopScreenShare();
      };
      return displayStream;
    } catch {
      return null;
    }
  }

  static async stopScreenShare() {
    if (this.localStream) {
      const cameraTrack = this.localStream.getVideoTracks()[0];
      if (this.peerConnection && cameraTrack) {
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(cameraTrack);
        }
      }
    }
  }

  static setVoiceLevelCallback(cb: ((level: number) => void) | null) {
    this.onVoiceLevelCallback = cb;
  }

  static stopMediaStream() {
    this.stopAudioRelay();
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = null;
    this.onRemoteStreamCallback = null;
    this.onVoiceLevelCallback = null;
    this.processedIceCandidates.clear();
  }

  // 1. Start Outgoing Call (Caller side)
  static async startCall(
    caller: StaffUser,
    recipient: StaffUser,
    callType: CallType,
    onRemoteStream?: (stream: MediaStream) => void
  ): Promise<ActiveCallSession> {
    this.stopMediaStream();
    getSharedAudioContext();
    this.onRemoteStreamCallback = onRemoteStream || null;

    const stream = await this.getMediaStream(callType);
    const pc = new RTCPeerConnection(RTC_ICE_SERVERS);
    this.peerConnection = pc;

    // Add local audio and video tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = event => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(event.streams[0]);
        }
      }
    };

    const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Relay local ICE candidates
    pc.onicecandidate = event => {
      if (event.candidate) {
        fetch("/api/sync/call/ice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callId,
            candidate: event.candidate,
            senderId: caller.id,
            targetId: recipient.id,
          }),
        }).catch(() => {});
      }
    };

    // Create SDP Offer
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === "video",
    });
    await pc.setLocalDescription(offer);

    const callSession: ActiveCallSession = {
      callId,
      callerId: caller.id,
      callerName: caller.fullName,
      callerRole: caller.role,
      callerAvatarBg: caller.avatarBg || "#F97316",
      recipientId: recipient.id,
      recipientName: recipient.fullName,
      recipientRole: recipient.role,
      recipientAvatarBg: recipient.avatarBg || "#059669",
      callType,
      status: "RINGING",
      startedAt: Date.now(),
      offer: {
        type: offer.type,
        sdp: offer.sdp,
      },
    };

    // Start caller audio relay
    this.startAudioRelay(callId, caller.id, recipient.id, stream);

    ringtones.playOutgoingRingback();

    try {
      await fetch("/api/sync/call/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callSession),
      });
    } catch (err) {
      console.error("Failed to start call signal:", err);
    }

    return callSession;
  }

  // 2. Answer Incoming Call (Recipient side)
  static async answerCall(
    callSession: ActiveCallSession,
    responderId: string,
    onRemoteStream?: (stream: MediaStream) => void
  ): Promise<void> {
    ringtones.stop();
    this.stopMediaStream();
    getSharedAudioContext();
    this.onRemoteStreamCallback = onRemoteStream || null;

    const stream = await this.getMediaStream(callSession.callType);
    const pc = new RTCPeerConnection(RTC_ICE_SERVERS);
    this.peerConnection = pc;

    // Add local microphone/camera tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = event => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(event.streams[0]);
        }
      }
    };

    // Relay local ICE candidates
    pc.onicecandidate = event => {
      if (event.candidate) {
        fetch("/api/sync/call/ice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callId: callSession.callId,
            candidate: event.candidate,
            senderId: responderId,
            targetId: callSession.callerId,
          }),
        }).catch(() => {});
      }
    };

    // Set Remote Offer Description
    if (callSession.offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(callSession.offer));
    }

    // Create SDP Answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Start recipient audio relay
    this.startAudioRelay(callSession.callId, responderId, callSession.callerId, stream);

    try {
      await fetch("/api/sync/call/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: callSession.callId,
          answer: { type: answer.type, sdp: answer.sdp },
          responderId,
        }),
      });
    } catch (err) {
      console.error("Failed to answer call:", err);
    }
  }

  // 3. Caller receives SDP Answer from Recipient
  static async handleRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.peerConnection && this.peerConnection.signalingState === "have-local-offer") {
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error("Error setting remote description on caller:", err);
      }
    }
  }

  // 4. Handle incoming ICE candidate
  static async handleRemoteCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    const key = JSON.stringify(candidate);
    if (this.processedIceCandidates.has(key)) return;
    this.processedIceCandidates.add(key);

    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("Could not add ICE candidate:", err);
      }
    }
  }

  // 5. Decline / End Call
  static async endCall(
    callId: string,
    endedBy: string,
    reason: "ended" | "declined" | "missed" = "ended",
    durationSeconds = 0
  ): Promise<void> {
    ringtones.stop();
    this.stopMediaStream();

    try {
      await fetch("/api/sync/call/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, endedBy, reason, durationSeconds }),
      });
    } catch (err) {
      console.error("Failed to end call:", err);
    }
  }
}
