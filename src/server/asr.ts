import "server-only";
import type { Language } from "@/core/types";

/**
 * Omnilingual ASR (Meta, open weights), self-hosted behind a small HTTP contract:
 * POST {ASR_SERVICE_URL}/transcribe, multipart field "audio", form field "language" (amh | orm),
 * JSON back: { text, segments: [{ start, end, text }] }.
 */
export type AsrResult = { text: string; segments: Array<{ start: number; end: number; text: string }>; ms: number };

export function asrConfigured(): boolean {
  return Boolean(process.env.ASR_SERVICE_URL?.trim());
}

const CODE: Record<Language, string> = { am: "amh", om: "orm" };

export async function transcribe(audio: Blob, language: Language, filename = "turn.webm"): Promise<AsrResult> {
  const base = process.env.ASR_SERVICE_URL?.trim().replace(/\/$/, "");
  if (!base) throw new Error("asr_not_configured");
  const form = new FormData();
  form.append("audio", audio, filename);
  form.append("language", CODE[language]);
  const headers: Record<string, string> = {};
  if (process.env.ASR_SERVICE_TOKEN) headers.Authorization = `Bearer ${process.env.ASR_SERVICE_TOKEN}`;
  const t0 = Date.now();
  const res = await fetch(`${base}/transcribe`, { method: "POST", body: form, headers, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`asr_http_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { text?: string; segments?: AsrResult["segments"] };
  return { text: (json.text || "").trim(), segments: json.segments || [], ms: Date.now() - t0 };
}
