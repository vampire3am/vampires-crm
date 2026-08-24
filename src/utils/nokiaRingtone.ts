// =========================================================================
// OFFICIAL NOKIA TUNE RINGTONE (GRANDE VALSE) WAV SYNTHESIZER
// Generates authentic 44.1kHz 16-bit PCM WAV for infinite background looping
// =========================================================================

function generateNokiaWav(): string {
  const sampleRate = 44100;
  const totalDuration = 3.2; // 3.2 seconds total cycle (melody + short breath pause)
  const totalSamples = Math.floor(sampleRate * totalDuration);
  const buffer = new Float32Array(totalSamples);

  // Exact Official Nokia Tune Notes (Grande Valse)
  const Cs5 = 554.37; // C#5
  const D5 = 587.33;  // D5
  const E5 = 659.25;  // E5
  const Fs5 = 739.99; // F#5
  const Gs5 = 830.61; // G#5
  const A5 = 880.00;  // A5
  const B5 = 987.77;  // B5
  const Cs6 = 1108.73;// C#6
  const D6 = 1174.66; // D6
  const E6 = 1318.51; // E6

  // Authentic Nokia Phrase Timing & Velocity
  const notes = [
    // Measure 1: E6 -> D6 -> F#5 -> G#5
    { freq: E6,  start: 0.00, dur: 0.16, vol: 0.95 },
    { freq: D6,  start: 0.16, dur: 0.16, vol: 0.90 },
    { freq: Fs5, start: 0.32, dur: 0.28, vol: 0.85 },
    { freq: Gs5, start: 0.60, dur: 0.28, vol: 0.90 },

    // Measure 2: C#6 -> B5 -> D5 -> E5
    { freq: Cs6, start: 0.90, dur: 0.16, vol: 0.95 },
    { freq: B5,  start: 1.06, dur: 0.16, vol: 0.90 },
    { freq: D5,  start: 1.22, dur: 0.28, vol: 0.85 },
    { freq: E5,  start: 1.50, dur: 0.28, vol: 0.90 },

    // Measure 3: B5 -> A5 -> C#5 -> E5
    { freq: B5,  start: 1.80, dur: 0.16, vol: 0.95 },
    { freq: A5,  start: 1.96, dur: 0.16, vol: 0.90 },
    { freq: Cs5, start: 2.12, dur: 0.28, vol: 0.85 },
    { freq: E5,  start: 2.40, dur: 0.28, vol: 0.90 },

    // Measure 4: A5 (Iconic sustained bell finale)
    { freq: A5,  start: 2.70, dur: 0.45, vol: 1.00 },
  ];

  // Synthesize each note with classic Nokia acoustic chime timbre
  notes.forEach(({ freq, start, dur, vol }) => {
    const startSample = Math.floor(start * sampleRate);
    const numSamples = Math.floor(dur * sampleRate);

    for (let i = 0; i < numSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;

      const t = i / sampleRate;
      // Sharp classic synthesizer attack + smooth exponential decay
      const env = Math.exp(-t * (7.5 / dur)) * (1 - Math.exp(-t * 140));

      // Pure square-softened sine harmonic (Iconic Nokia sound signature)
      const s1 = Math.sin(2 * Math.PI * freq * t);
      const s2 = 0.35 * Math.sin(2 * Math.PI * freq * 2 * t);
      const s3 = 0.15 * Math.sin(2 * Math.PI * freq * 3 * t);
      const s4 = 0.08 * Math.sin(2 * Math.PI * freq * 4 * t);

      const sampleVal = (s1 + s2 + s3 + s4) * env * vol * 0.38;
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

// Persistent HTML5 Audio Loop Player for Nokia Ringtone
let nokiaAudioInstance: HTMLAudioElement | null = null;

export function getNokiaRingtoneAudio(): HTMLAudioElement {
  if (typeof window === "undefined") {
    return null as any;
  }

  if (!nokiaAudioInstance) {
    try {
      const wavUrl = generateNokiaWav();
      const audio = new Audio(wavUrl);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 1.0;
      nokiaAudioInstance = audio;
    } catch {
      const audio = new Audio();
      audio.loop = true;
      nokiaAudioInstance = audio;
    }
  }

  return nokiaAudioInstance;
}
