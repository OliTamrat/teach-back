/**
 * Browser side: turn whatever MediaRecorder produced into the 16 kHz mono WAV every listener takes.
 * Decoding uses the browser's own decoder, so Opus in WebM (Chrome, Firefox) and AAC in MP4
 * (Safari) both work. If decoding fails the original clip is returned and the caller says so.
 */
import { WAV_RATE, encodeWav, resample, toMono } from "@/core/wav";

export async function toWav(blob: Blob): Promise<{ blob: Blob; converted: boolean; seconds: number }> {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    try {
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      const channels: Float32Array[] = [];
      for (let c = 0; c < decoded.numberOfChannels; c++) channels.push(decoded.getChannelData(c));
      const mono = resample(toMono(channels), decoded.sampleRate, WAV_RATE);
      return { blob: new Blob([encodeWav(mono, WAV_RATE)], { type: "audio/wav" }), converted: true, seconds: mono.length / WAV_RATE };
    } finally { void ctx.close(); }
  } catch {
    return { blob, converted: false, seconds: 0 };
  }
}
