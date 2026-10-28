import "server-only";
import type { Language } from "@/core/types";
import { LANGUAGE_NAME, labelReadPrompt, listenPrompt, parseLabelReply, parseListenReply, renderPrompt, type LabelReply, type ListenReply } from "@/core/prompts";

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
 * and Afaan Oromo coverage is unverified, so a turn that used it says so.
 *
 * Two multipart parts, named `request` and `audio`. Not the OpenAI-style `model`/`language`/`file`
 * form this was first written to: two live 400s walked it to the real one, and dev.meta.ai's
 * reference confirms it. The `request` part carries mode, model, audioEncoding and languageBias.
 */
/**
 * The one container Muse Voice Transcribe accepts, or null if this is not it.
 *
 * Its documented contract is a RIFF/WAVE container holding mono 16-bit integer PCM at 16 or 24 kHz
 * — `audioEncoding` is "WAV", "PCM_16KHZ" or "PCM_24KHZ" and nothing else. A browser records Opus
 * in WebM, so a recorded turn is refused here rather than sent to be refused there.
 */
export function voiceEncoding(format: string): "WAV" | null {
  const f = format.toLowerCase().replace(/^x-|^vnd\./, "");
  return f === "wav" || f === "wave" ? "WAV" : null;
}

export async function voiceTranscribe(audio: Buffer, format: string, language: Language, fetchImpl: typeof fetch = fetch): Promise<{ text: string; ms: number; raw: unknown }> {
  if (!KEY()) throw new Error("meta_not_configured");
  const encoding = voiceEncoding(format);
  if (!encoding) throw new Error(`voice_needs_wav: the clip is ${format}, and this endpoint takes only a RIFF/WAVE container, mono 16-bit PCM at 16 or 24 kHz`);
  if (audio.byteLength > 32 * 1024 * 1024) throw new Error("voice_audio_too_large: the endpoint takes at most 32 MB");
  const t0 = Date.now();
  const form = new FormData();
  // PUSH_TO_TALK: one speaker, one utterance, which is what a turn is. The other modes are
  // ENDPOINTING and DIARIZATION, for a stream and for a meeting. languageBias takes the language
  // written out, not a code.
  form.append("request", new Blob([JSON.stringify({
    mode: "PUSH_TO_TALK",
    model: voiceModel(),
    audioEncoding: encoding,
    languageBias: [LANGUAGE_NAME[language]],
  })], { type: "application/json" }));
  form.append("audio", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "turn.wav");
  const res = await fetchImpl(`${BASE()}/asr/transcribe`, { method: "POST", headers: { Authorization: `Bearer ${KEY()}` }, body: form, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`voice_http_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { transcript?: string; text?: string; turns?: Array<{ transcript?: string }> };
  const text = (json.transcript || json.text || (json.turns || []).map(t => t.transcript || "").join(" ")).trim();
  return { text, ms: Date.now() - t0, raw: json };
}

