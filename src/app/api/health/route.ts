import { NextResponse } from "next/server";
import { asrReady } from "@/server/asr";
import { accessCodeConfigured, guardStats } from "@/server/guard";

export const dynamic = "force-dynamic";

/** Reports what is configured without ever printing a secret. */
export async function GET(req: Request) {
  const has = (k: string) => Boolean(process.env[k] && process.env[k]!.trim());
  const body = {
    ok: true,
    builtDuring: "2026-10-26 to 2026-11-04",
    metaModelApi: {
      key: has("META_MODEL_API_KEY") ? "set" : "missing",
      baseUrl: process.env.META_MODEL_BASE_URL || "https://api.meta.ai/v1",
      sparkModel: process.env.META_SPARK_MODEL || "muse-spark-1.3",
      sparkAudioModel: process.env.META_SPARK_AUDIO_MODEL || "muse-spark-1.2",
      samModel: process.env.META_SAM_MODEL || "sam-3.1",
      voiceModel: process.env.META_VOICE_MODEL || "muse-voice-transcribe-1.0",
    },
    asr: {
      service: has("ASR_SERVICE_URL") ? "set" : "missing",
      token: has("ASR_SERVICE_TOKEN") ? "set" : "missing",
    },
    core: { calendar: "deterministic", facts: "deterministic", flags: "deterministic" },
    guard: {
      accessCode: accessCodeConfigured() ? "set" : "open",
      voiceFallback: process.env.META_VOICE_FALLBACK === "off" ? "off" : "on",
      ...guardStats(),
    },
  };
  // ?probe=asr asks the Space whether its model is loaded (a cold start takes 15 to 25 minutes).
  const probe = new URL(req.url).searchParams.get("probe") === "asr" && body.asr.service === "set" ? await asrReady() : undefined;
  const ready = body.metaModelApi.key === "set" && body.asr.service === "set";
  return NextResponse.json({ ...body, asr: { ...body.asr, ...(probe ? { probe } : {}) }, ready }, { status: ready ? 200 : 503 });
}
