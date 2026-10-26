import "server-only";
import type { Language } from "@/core/types";
import { listenPrompt, parseListenReply, renderPrompt, type ListenReply } from "@/core/prompts";

/**
 * Meta Model API, OpenAI-compatible chat completions. Text analysis on Muse Spark 1.3; audio on
 * Spark 1.2, because Meta's docs say audio understanding in 1.3 is not fully supported. Spark is a
 * reasoning model and spends tokens thinking before it answers, so budgets are generous.
 */
const BASE = () => (process.env.META_MODEL_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");
const KEY = () => process.env.META_MODEL_API_KEY?.trim() || "";
export const sparkModel = () => process.env.META_SPARK_MODEL || "muse-spark-1.3";
export const sparkAudioModel = () => process.env.META_SPARK_AUDIO_MODEL || "muse-spark-1.2";

export function metaConfigured(): boolean { return Boolean(KEY()); }

type Content = string | Array<{ type: "text"; text: string } | { type: "input_audio"; input_audio: { data: string; format: string } }>;

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
