import { describe, expect, it } from "vitest";
import { encodeWav, resample, toMono, wavInfo } from "./wav";

describe("WAV for the listeners", () => {
  it("writes a mono 16-bit RIFF/WAVE header the endpoint accepts", () => {
    const s = new Float32Array(16000); for (let i = 0; i < s.length; i++) s[i] = Math.sin(i / 10);
    const buf = encodeWav(s, 16000);
    expect(buf.byteLength).toBe(44 + 32000);
    expect(wavInfo(buf)).toEqual({ channels: 1, sampleRate: 16000, bits: 16, samples: 16000 });
    const v = new DataView(buf);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint32(28, true)).toBe(32000); // byte rate
  });
  it("resamples 48 kHz to 16 kHz and keeps the length in proportion", () => {
    const s = new Float32Array(48000).fill(0.5);
    const r = resample(s, 48000, 16000);
    expect(r.length).toBe(16000);
    expect(r[100]).toBeCloseTo(0.5, 5);
    expect(resample(s, 16000, 16000)).toBe(s);
  });
  it("mixes stereo to mono and clips at full scale", () => {
    const m = toMono([new Float32Array([1, 0]), new Float32Array([0, 1])]);
    expect(Array.from(m)).toEqual([0.5, 0.5]);
    const v = new DataView(encodeWav(new Float32Array([2, -2]), 16000));
    expect(v.getInt16(44, true)).toBe(0x7fff); expect(v.getInt16(46, true)).toBe(-0x8000);
  });
  it("rejects something that is not a WAV", () => {
    expect(wavInfo(new TextEncoder().encode("not a wave file at all, just text").buffer as ArrayBuffer)).toBeNull();
  });
});
