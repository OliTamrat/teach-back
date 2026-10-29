/**
 * Keeps the microphone open and cuts the audio into turns at pauses, in the browser. Speech is
 * energy above a floor measured from the room itself; a turn ends after a silence of about a
 * second, or at a ceiling length so a long speaker still gets checked in pieces. Each finished turn
 * is handed over as 16 kHz mono WAV, the one container all three listeners take.
 */
import { WAV_RATE, encodeWav, resample } from "@/core/wav";

export type Segmenter = { stop: () => void; cut: () => void; level: () => number };

export function startSegmenter(stream: MediaStream, onTurn: (wav: Blob, seconds: number) => void, opts: { silenceMs?: number; minMs?: number; maxMs?: number } = {}): Segmenter {
  const silenceMs = opts.silenceMs ?? 1100, minMs = opts.minMs ?? 1200, maxMs = opts.maxMs ?? 45_000;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const rate = ctx.sampleRate;
  let chunks: Float32Array[] = [];
  let samples = 0, speechSamples = 0, silenceSinceSpeech = 0, inSpeech = false, floor = 0.01, level = 0;
  const preRoll: Float32Array[] = []; // a little audio before the first loud frame, so a word is not clipped

  function finish() {
    if (!inSpeech) { chunks = []; samples = 0; return; }
    const all = new Float32Array(samples); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    chunks = []; samples = 0; inSpeech = false; speechSamples = 0; silenceSinceSpeech = 0;
    if (all.length < (minMs / 1000) * rate) return;
    const mono = resample(all, rate, WAV_RATE);
    onTurn(new Blob([encodeWav(mono, WAV_RATE)], { type: "audio/wav" }), mono.length / WAV_RATE);
  }

  node.onaudioprocess = e => {
    const input = e.inputBuffer.getChannelData(0);
    let sum = 0; for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    const rms = Math.sqrt(sum / input.length);
    level = rms;
    // The floor follows the room slowly while nobody is speaking.
    if (!inSpeech) floor = floor * 0.95 + rms * 0.05;
    const loud = rms > Math.max(0.012, floor * 3);
    const frame = new Float32Array(input);
    if (!inSpeech) {
      preRoll.push(frame); if (preRoll.length > 3) preRoll.shift();
      if (loud) { inSpeech = true; chunks = [...preRoll]; samples = chunks.reduce((n, c) => n + c.length, 0); speechSamples = 0; silenceSinceSpeech = 0; }
      else return;
    }
    chunks.push(frame); samples += frame.length;
    if (loud) { speechSamples += frame.length; silenceSinceSpeech = 0; } else silenceSinceSpeech += frame.length;
    const ms = (samples / rate) * 1000;
    if ((silenceSinceSpeech / rate) * 1000 >= silenceMs && speechSamples > 0) finish();
    else if (ms >= maxMs) finish();
  };
  source.connect(node); node.connect(ctx.destination);
  return {
    stop: () => { try { finish(); } finally { node.disconnect(); source.disconnect(); stream.getTracks().forEach(t => t.stop()); void ctx.close(); } },
    cut: () => finish(),
    level: () => level,
  };
}
