/**
 * WAV encoding, pure. The browser records Opus in WebM, and of the three listeners only the Space
 * decodes that; Muse Voice Transcribe takes a RIFF/WAVE container holding mono 16-bit PCM at 16 or
 * 24 kHz and nothing else (decision 23), and Spark's audio input was confirmed live on WAV. So every
 * clip is converted here before it leaves the device, and all three listeners get the same bytes.
 */
export const WAV_RATE = 16000;

/** Mix any number of channels to one. */
export function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length;
  const out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** Linear resampling, good enough for speech going to a 16 kHz recogniser. */
export function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples;
  const ratio = from / to;
  const n = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const j = Math.floor(x);
    const t = x - j;
    const a = samples[Math.min(j, samples.length - 1)], b = samples[Math.min(j + 1, samples.length - 1)];
    out[i] = a + (b - a) * t;
  }
  return out;
}

/** 16-bit PCM mono RIFF/WAVE. */
export function encodeWav(samples: Float32Array, sampleRate = WAV_RATE): ArrayBuffer {
  const bytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + bytes, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/** Read the header back, for tests and for the server to say what it was given. */
export function wavInfo(buf: ArrayBuffer): { channels: number; sampleRate: number; bits: number; samples: number } | null {
  if (buf.byteLength < 44) return null;
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  const channels = v.getUint16(22, true), sampleRate = v.getUint32(24, true), bits = v.getUint16(34, true);
  return { channels, sampleRate, bits, samples: v.getUint32(40, true) / (bits / 8) / channels };
}
