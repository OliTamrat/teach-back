import { NextResponse } from "next/server";
import { extractFacts } from "@/core/facts";
import { analyzeTurn, languageMismatch } from "@/core/compare";
import { teachBackQuestion } from "@/core/question";
import { detectLanguage } from "@/core/language";
import type { Flag, Language, Listener } from "@/core/types";
import { asrConfigured, transcribe } from "@/server/asr";
import { listen, metaConfigured, renderEnglish } from "@/server/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * One patient turn, from audio to flags.
 * multipart: audio (file), language (am|om), reference (YYYY-MM-DD, the day spoken)
 *
 * Listener A: Omnilingual ASR transcribes in the session language, Spark 1.3 renders English.
 * Listener B: Spark 1.2 hears the same audio and renders English itself, and says which language it heard.
 * Code extracts the facts from both renderings and raises the flags. Either listener may be absent;
 * the screen says so rather than pretending.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const audio = form.get("audio");
  const language = form.get("language") === "om" ? "om" : "am";
  const reference = parseRef(String(form.get("reference") || ""));
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "no_audio" }, { status: 400 });
  if (audio.size > 15 * 1024 * 1024) return NextResponse.json({ error: "audio_too_large" }, { status: 413 });

  const format = (audio.type.split("/")[1] || "webm").split(";")[0];
  const buf = Buffer.from(await audio.arrayBuffer());
  const notes: string[] = [];

  const [asr, second] = await Promise.all([
    asrConfigured() ? transcribe(audio, language as Language, `turn.${format}`).catch(e => { notes.push(`ASR failed: ${msg(e)}`); return null; }) : (notes.push("ASR service not configured"), Promise.resolve(null)),
    metaConfigured() ? listen(buf, format, language as Language).catch(e => { notes.push(`Second listener failed: ${msg(e)}`); return null; }) : (notes.push("Meta Model API key not configured"), Promise.resolve(null)),
  ]);

  let primary: Listener | null = null;
  if (asr && asr.text) {
    let english = "";
    if (metaConfigured()) {
      try { english = (await renderEnglish(asr.text, language as Language)).text; }
      catch (e) { notes.push(`Rendering failed: ${msg(e)}`); }
    } else notes.push("No English rendering without the Meta Model API key");
    primary = { name: "Listener A (Omnilingual ASR)", english, facts: english ? extractFacts(english, { reference, language: language as Language }) : [] };
  }

  let secondary: Listener | undefined;
  if (second?.reply?.english) {
    secondary = { name: "Listener B (Muse Spark)", english: second.reply.english, facts: extractFacts(second.reply.english, { reference, language: language as Language }) };
  }

  // If only the second listener heard anything, it becomes the primary so the screen still has a rendering to mark up.
  if (!primary && secondary) { primary = secondary; secondary = undefined; notes.push("Only the second listener produced a rendering"); }
  if (!primary) return NextResponse.json({ error: "no_listener", notes, transcript: asr?.text ?? "" }, { status: 502 });

  // Language check: the second listener's judgement first, the script heuristic on the transcript as fallback.
  const extra: Flag[] = [];
  let detected: { language: Language | null; confidence: number; by: string } = { language: null, confidence: 0, by: "none" };
  if (second?.reply && second.reply.language !== "other") detected = { language: second.reply.language, confidence: second.reply.confidence, by: "second listener" };
  else {
    const guess = detectLanguage(second?.reply?.transcript || asr?.text || "");
    detected = { ...guess, by: "script heuristic" };
  }
  const mismatch = languageMismatch(language as Language, detected.language, detected.confidence);
  if (mismatch) extra.push(mismatch);

  const turn = analyzeTurn(primary, secondary, extra);
  return NextResponse.json({
    language, reference: iso(reference), detected, notes,
    transcript: asr?.text ?? second?.reply?.transcript ?? "",
    secondTranscript: second?.reply?.transcript ?? "",
    timings: { asrMs: asr?.ms ?? null, listenMs: second?.ms ?? null },
    primary: turn.primary, secondary: turn.secondary ?? null, flags: turn.flags,
    question: teachBackQuestion(turn.primary.facts),
  });
}

function parseRef(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };
  const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}
function iso(d: { year: number; month: number; day: number }) { return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`; }
function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }
