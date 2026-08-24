// =========================================================================
// HONOR X90 / TUNE LIVING RINGTONE SYNTHESIZER & WAV GENERATOR
// Creates a 44.1kHz 16-bit PCM WAV Loop that plays in foreground & background
// =========================================================================

function generateHonorWav(): string {
  const sampleRate = 44100;
  const bpm = 138;
  const beatSec = 60 / bpm; // ~0.435s per beat
  const totalDuration = 4.2; // 4.2 seconds loop
  const totalSamples = Math.floor(sampleRate * totalDuration);
  const buffer = new Float32Array(totalSamples);

  // Exact Honor Tune Living Signature Melody Pattern
  // Notes in Hz
  const D5 = 587.33;
  const G5 = 783.99;
  const A5 = 880.00;
  const B5 = 987.77;
  const D6 = 1174.66;
  const E6 = 1318.51;
  const Fs6 = 1479.98; // F#6
  const G6 = 1567.98;
  const A6 = 1760.00;
  const B6 = 1975.53;
  const Cs7 = 2217.46; // C#7
  const D7 = 2349.32;

  const notes = [
    // Phrase 1: The Iconic High-Energy Opening
    { freq: D6, start: 0.00, dur: 0.18, vol: 0.8 },
    { freq: E6, start: 0.13, dur: 0.18, vol: 0.85 },
    { freq: Fs6, start: 0.26, dur: 0.22, vol: 0.9 },
    { freq: A6, start: 0.42, dur: 0.35, vol: 1.0 },
    { freq: Fs6, start: 0.65, dur: 0.20, vol: 0.85 },
    { freq: E6, start: 0.82, dur: 0.22, vol: 0.8 },
    { freq: D6, start: 1.00, dur: 0.35, vol: 0.85 },

    // Phrase 2: Bounce Rhythm
    { freq: B5, start: 1.25, dur: 0.18, vol: 0.75 },
    { freq: D6, start: 1.38, dur: 0.18, vol: 0.8 },
    { freq: E6, start: 1.51, dur: 0.20, vol: 0.85 },
    { freq: Fs6, start: 1.66, dur: 0.24, vol: 0.9 },
    { freq: B6, start: 1.85, dur: 0.38, vol: 1.0 },
    { freq: A6, start: 2.10, dur: 0.30, vol: 0.9 },

    // Phrase 3: Ascending Climax & Resolution
    { freq: D7, start: 2.35, dur: 0.28, vol: 1.0 },
    { freq: Cs7, start: 2.58, dur: 0.26, vol: 0.95 },
    { freq: A6, start: 2.80, dur: 0.28, vol: 0.9 },
    { freq: Fs6, start: 3.02, dur: 0.24, vol: 0.85 },
    { freq: E6, start: 3.22, dur: 0.28, vol: 0.8 },
    { freq: D6, start: 3.45, dur: 0.65, vol: 0.95 }, // Sustained bell chime
  ];

  // Render each marimba/chime note with rich harmonic overtones
  notes.forEach(({ freq, start, dur, vol }) => {
    const startSample = Math.floor(start * sampleRate);
    const numSamples = Math.floor(dur * sampleRate);

    for (let i = 0; i < numSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;

      const t = i / sampleRate;
      // Sharp acoustic attack + exponential decay
      const env = Math.exp(-t * (8 / dur)) * (1 - Math.exp(-t * 120));

      // 1st Harmonic (Fundamental) + 2nd Harmonic + 3rd Harmonic (Bright marimba bell)
      const s1 = Math.sin(2 * Math.PI * freq * t);
      const s2 = 0.45 * Math.sin(2 * Math.PI * freq * 2 * t);
      const s3 = 0.20 * Math.sin(2 * Math.PI * freq * 3 * t);
      const s4 = 0.10 * Math.sin(2 * Math.PI * freq * 4 * t);

      const sampleVal = (s1 + s2 + s3 + s4) * env * vol * 0.35;
      buffer[idx] = Math.max(-1, Math.min(1, buffer[idx] + sampleVal));
    }
  });

  // Convert Float32Array PCM to 16-bit WAV binary format
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, totalSamples * 2, true);

  // Create combined buffer
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

// Generate the persistent Honor Ringtone Audio Object
let honorAudioInstance: HTMLAudioElement | null = null;

export function getHonorRingtoneAudio(): HTMLAudioElement {
  if (typeof window === "undefined") {
    return null as any;
  }

  if (!honorAudioInstance) {
    try {
      const wavUrl = generateHonorWav();
      const audio = new Audio(wavUrl);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 1.0;
      honorAudioInstance = audio;
    } catch {
      // Fallback audio element
      const audio = new Audio();
      audio.loop = true;
      honorAudioInstance = audio;
    }
  }

  return honorAudioInstance;
}
