import "server-only";
import type { Language } from "@/core/types";

/**
 * Omnilingual ASR (Meta, open weights), self-hosted as Kintale's Hugging Face Space
 * (Kintale/services/asr). Its contract, read from that service's code rather than remembered:
 *
 *   POST {ASR_SERVICE_URL}/            raw audio body, Content-Type = the recording's mime type
 *     X-Language-3: amh_Ethi | orm_Latn | eng_Latn
 *     Authorization: Bearer <Hugging Face read token>   (a private Space refuses without it)
 *   -> { segments: [{ start, end, text }], from, ended, next }      (no top-level text)
 *   GET  {ASR_SERVICE_URL}/            -> { ready: boolean, model, languages, error }
 *
 * The Space sleeps when idle and takes 15 to 25 minutes to wake, during which a transcription
 * request gets a 503. The caller is told that in plain words so nobody mistakes it for a bug.
 */
export type AsrResult = { text: string; segments: Array<{ start: number; end: number; text: string }>; ms: number };

export function asrConfigured(): boolean {
  return Boolean(process.env.ASR_SERVICE_URL?.trim());
}

export const LANG_CODE_3: Record<Language, string> = { am: "amh_Ethi", om: "orm_Latn" };

export class AsrError extends Error {
  constructor(public status: number, message: string, public hint: string) { super(message); }
}

function base(): string {
  const url = process.env.ASR_SERVICE_URL?.trim().replace(/\/$/, "");
  if (!url) throw new AsrError(503, "asr_not_configured", "ASR_SERVICE_URL is not set.");
  return url;
}
function authHeaders(): Record<string, string> {
  const t = process.env.ASR_SERVICE_TOKEN?.trim();
  return t ? { authorization: `Bearer ${t}` } : {};
}

export function explainAsrStatus(status: number): string {
  if (status === 503) return "The ASR model is still loading on the Space (a cold start takes 15 to 25 minutes). Try again shortly.";
  if (status === 401 || status === 403) return "The Space refused the token. ASR_SERVICE_TOKEN must be a Hugging Face token that can read it.";
  if (status === 404) return "Nothing answered at that path. ASR_SERVICE_URL must be the Space's own address, https://<owner>-<space>.hf.space/, not its huggingface.co page.";
  if (status === 413) return "The recording is larger than the Space accepts.";
  if (status === 400) return "The Space rejected the request (language code or audio).";
  return `The ASR service answered ${status}.`;
}

/** Is the Space awake with the model loaded? Never throws. */
export async function asrReady(fetchImpl: typeof fetch = fetch): Promise<{ reachable: boolean; ready: boolean; model?: string; detail?: string }> {
  try {
    const res = await fetchImpl(`${base()}/`, { headers: authHeaders(), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { reachable: true, ready: false, detail: explainAsrStatus(res.status) };
    const j = (await res.json()) as { ready?: boolean; model?: string; error?: string | null };
    return { reachable: true, ready: Boolean(j.ready), model: j.model, detail: j.error || undefined };
  } catch (e) {
    return { reachable: false, ready: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function transcribe(audio: Blob, language: Language, fetchImpl: typeof fetch = fetch): Promise<AsrResult> {
  const t0 = Date.now();
  const res = await fetchImpl(`${base()}/`, {
    method: "POST",
    headers: { "content-type": audio.type || "audio/webm", "x-language-3": LANG_CODE_3[language], ...authHeaders() },
    body: Buffer.from(await audio.arrayBuffer()),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new AsrError(res.status, `asr_http_${res.status}`, explainAsrStatus(res.status));
  const json = (await res.json()) as { segments?: AsrResult["segments"]; text?: string };
  const segments = (json.segments || []).filter(s => s && typeof s.text === "string");
  const text = (json.text || segments.map(s => s.text.trim()).filter(Boolean).join(" ")).trim();
  return { text, segments, ms: Date.now() - t0 };
}
