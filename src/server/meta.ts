import "server-only";
import type { Language } from "@/core/types";
import { labelReadPrompt, listenPrompt, parseLabelReply, parseListenReply, renderPrompt, type LabelReply, type ListenReply } from "@/core/prompts";

/**
 * Meta Model API, OpenAI-compatible chat completions. Text analysis on Muse Spark 1.3; audio on
 * Spark 1.2, because Meta's docs say audio understanding in 1.3 is not fully supported. Spark is a
 * reasoning model and spends tokens thinking before it answers, so budgets are generous.
 */
const BASE = () => (process.env.META_MODEL_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");
const KEY = () => process.env.META_MODEL_API_KEY?.trim() || "";
export const sparkModel = () => process.env.META_SPARK_MODEL || "muse-spark-1.3";
export const sparkAudioModel = () => process.env.META_SPARK_AUDIO_MODEL || "muse-spark-1.2";
export const voiceModel = () => process.env.META_VOICE_MODEL || "muse-voice-transcribe-1.0";

export function metaConfigured(): boolean { return Boolean(KEY()); }

type Content = string | Array<
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: string } }
  | { type: "image_url"; image_url: { url: string } }
>;

async function chat(model: string, content: Content, maxTokens: number): Promise<{ text: string; ms: number; usage?: unknown }> {
  if (!KEY()) throw new Error("meta_not_configured");
  const t0 = Date.now();
  const res = await fetch(`${BASE()}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content }], temperature: 0, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`meta_http_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }>; usage?: unknown };
  const c = json.choices?.[0]?.message?.content;
  const text = typeof c === "string" ? c : Array.isArray(c) ? c.map((p: { text?: string }) => p.text || "").join("") : "";
  return { text: text.trim(), ms: Date.now() - t0, usage: json.usage };
}

/** First listener's rendering: ASR transcript -> English. */
export async function renderEnglish(transcript: string, language: Language) {
  return chat(sparkModel(), renderPrompt(transcript, language), 3000);
}

/** Second listener: Spark hears the audio itself. */
export async function listen(audio: Buffer, format: string, expected: Language): Promise<{ reply: ListenReply | null; raw: string; ms: number }> {
  const fmt = format === "m4a" ? "mp4" : format;
  const { text, ms } = await chat(sparkAudioModel(), [
    { type: "input_audio", input_audio: { data: audio.toString("base64"), format: fmt } },
    { type: "text", text: listenPrompt(expected) },
  ], 3000);
  return { reply: parseListenReply(text), raw: text, ms };
}

/** Label reader: Spark looks at a photo (or a crop the reviewer chose) and reports what is printed. */
export async function readLabel(image: Buffer, mime: string): Promise<{ reply: LabelReply | null; raw: string; ms: number }> {
  const { text, ms } = await chat(sparkModel(), [
    { type: "image_url", image_url: { url: `data:${mime};base64,${image.toString("base64")}` } },
    { type: "text", text: labelReadPrompt() },
  ], 3000);
  return { reply: parseLabelReply(text), raw: text, ms };
}

/**
 * Muse Voice Transcribe, Meta's hosted speech-to-text (POST /v1/asr/transcribe). The fallback
 * first listener when the self-hosted Omnilingual Space is asleep or not configured. Its Amharic
 * and Afaan Oromo coverage is unverified, so a turn that used it says so. The request shape is the
 * OpenAI-style multipart form; the first live call confirms it.
 */
export async function voiceTranscribe(audio: Buffer, format: string, language: Language): Promise<{ text: string; ms: number; raw: unknown }> {
  if (!KEY()) throw new Error("meta_not_configured");
  const t0 = Date.now();
  const form = new FormData();
  form.append("model", voiceModel());
  form.append("language", language);
  form.append("file", new Blob([new Uint8Array(audio)], { type: `audio/${format === "m4a" ? "mp4" : format}` }), `turn.${format}`);
  const res = await fetch(`${BASE()}/asr/transcribe`, { method: "POST", headers: { Authorization: `Bearer ${KEY()}` }, body: form, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`voice_http_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { text?: string; transcript?: string; segments?: Array<{ text?: string }> };
  const text = (json.text || json.transcript || (json.segments || []).map(s => s.text || "").join(" ")).trim();
  return { text, ms: Date.now() - t0, raw: json };
}
