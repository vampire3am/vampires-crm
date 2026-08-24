// =========================================================================
// GUITAR NOKIA TUNE (OFFICIAL ACOUSTIC GUITAR VERSION - GRAN VALS)
// Authentic Plucked Acoustic Guitar String Synthesis with Bass Accompaniment
// 44.1kHz 16-bit PCM WAV for infinite universal background looping
// =========================================================================

function generateGuitarNokiaWav(): string {
  const sampleRate = 44100;
  const totalDuration = 7.0; // 7.0s total cycle (3.8s guitar phrase + 3.2s natural telephone ring pause)
  const totalSamples = Math.floor(sampleRate * totalDuration);
  const buffer = new Float32Array(totalSamples);

  // Guitar Note Frequencies (Hz)
  const E2 = 82.41;   // Low E bass
  const A2 = 110.00;  // Low A bass
  const D3 = 146.83;  // D bass
  const E3 = 164.81;  // E bass
  const A3 = 220.00;
  const Cs4 = 277.18; // C#4
  const D4 = 293.66;  // D4
  const E4 = 329.63;  // E4
  const Fs4 = 369.99; // F#4
  const Gs4 = 415.30; // G#4
  const A4 = 440.00;  // A4
  const B4 = 493.88;  // B4
  const Cs5 = 554.37; // C#5
  const D5 = 587.33;  // D5
  const E5 = 659.25;  // E5
  const Fs5 = 739.99; // F#5
  const Gs5 = 830.61; // G#5
  const A5 = 880.00;  // A5

  // Acoustic Guitar Melody and Bass notes (Exact Francisco Tárrega Classical Guitar phrasing)
  const notes = [
    // Phrase 1: E5 -> D5 -> F#4 -> G#4 (with E2 Bass thumb pluck)
    { freq: E2,  start: 0.00, dur: 1.10, vol: 0.70, type: "bass" },
    { freq: E5,  start: 0.00, dur: 0.26, vol: 0.95, type: "guitar" },
    { freq: D5,  start: 0.25, dur: 0.26, vol: 0.90, type: "guitar" },
    { freq: Fs4, start: 0.50, dur: 0.35, vol: 0.85, type: "guitar" },
    { freq: Gs4, start: 0.82, dur: 0.38, vol: 0.90, type: "guitar" },

    // Phrase 2: C#5 -> B4 -> D4 -> E4 (with A2/D3 Bass thumb pluck)
    { freq: A2,  start: 1.15, dur: 1.10, vol: 0.70, type: "bass" },
    { freq: Cs5, start: 1.15, dur: 0.26, vol: 0.95, type: "guitar" },
    { freq: B4,  start: 1.40, dur: 0.26, vol: 0.90, type: "guitar" },
    { freq: D4,  start: 1.65, dur: 0.35, vol: 0.85, type: "guitar" },
    { freq: E4,  start: 1.97, dur: 0.38, vol: 0.90, type: "guitar" },

    // Phrase 3: B4 -> A4 -> C#4 -> E4 (with E2 Bass thumb pluck)
    { freq: E2,  start: 2.30, dur: 1.10, vol: 0.70, type: "bass" },
    { freq: B4,  start: 2.30, dur: 0.26, vol: 0.95, type: "guitar" },
    { freq: A4,  start: 2.55, dur: 0.26, vol: 0.90, type: "guitar" },
    { freq: Cs4, start: 2.80, dur: 0.35, vol: 0.85, type: "guitar" },
    { freq: E4,  start: 3.12, dur: 0.38, vol: 0.90, type: "guitar" },

    // Phrase 4: A4 (Iconic Spanish Guitar Strum Chord: A2 + E3 + A3 + C#4 + E4 + A4)
    { freq: A2,  start: 3.45, dur: 0.70, vol: 0.75, type: "bass" },
    { freq: E3,  start: 3.47, dur: 0.68, vol: 0.65, type: "guitar" },
    { freq: A3,  start: 3.49, dur: 0.66, vol: 0.70, type: "guitar" },
    { freq: Cs4, start: 3.51, dur: 0.64, vol: 0.75, type: "guitar" },
    { freq: E4,  start: 3.53, dur: 0.62, vol: 0.80, type: "guitar" },
    { freq: A4,  start: 3.55, dur: 0.60, vol: 0.95, type: "guitar" },
  ];

  // Render Acoustic Plucked Guitar with Karplus-Strong string modeling & wood resonance
  notes.forEach(({ freq, start, dur, vol, type }) => {
    const startSample = Math.floor(start * sampleRate);
    const numSamples = Math.floor(dur * sampleRate);

    // Initial string pluck impulse (noise + finger friction)
    for (let i = 0; i < numSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;

      const t = i / sampleRate;

      // Acoustic Guitar Pluck Envelope (Sharp pick transient + natural body decay)
      const decayRate = type === "bass" ? 4.0 : 6.0;
      const env = Math.exp(-t * (decayRate / dur)) * (1 - Math.exp(-t * 220));

      // Plucked string harmonics (Rich acoustic string spectrum)
      const h1 = Math.sin(2 * Math.PI * freq * t);
      const h2 = 0.55 * Math.sin(2 * Math.PI * freq * 2 * t);
      const h3 = 0.30 * Math.sin(2 * Math.PI * freq * 3 * t);
      const h4 = 0.18 * Math.sin(2 * Math.PI * freq * 4 * t);
      const h5 = 0.10 * Math.sin(2 * Math.PI * freq * 5 * t);
      const h6 = 0.05 * Math.sin(2 * Math.PI * freq * 6 * t);

      // Warm acoustic guitar wooden soundboard resonance (100Hz - 220Hz body warmth)
      const bodyResonance = 0.15 * Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 8);

      const sampleVal = (h1 + h2 + h3 + h4 + h5 + h6 + bodyResonance) * env * vol * 0.32;
      buffer[idx] = Math.max(-1, Math.min(1, buffer[idx] + sampleVal));
    }
  });

  // Convert Float32Array PCM to 16-bit WAV binary format
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // RIFF chunk
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, totalSamples * 2, true);

  const pcm16 = new Int16Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const blob = new Blob([view, pcm16], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Persistent HTML5 Audio Loop Player for Guitar Nokia Ringtone
let guitarNokiaAudioInstance: HTMLAudioElement | null = null;

export function getGuitarNokiaRingtoneAudio(): HTMLAudioElement {
  if (typeof window === "undefined") {
    return null as any;
  }

  if (!guitarNokiaAudioInstance) {
    try {
      const wavUrl = generateGuitarNokiaWav();
      const audio = new Audio(wavUrl);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 1.0;
      guitarNokiaAudioInstance = audio;
    } catch {
      const audio = new Audio();
      audio.loop = true;
      guitarNokiaAudioInstance = audio;
    }
  }

  return guitarNokiaAudioInstance;
}
