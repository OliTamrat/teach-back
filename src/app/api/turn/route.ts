import { NextResponse } from "next/server";
import { guardRequest, logCall } from "@/server/guard";
import { extractFacts } from "@/core/facts";
import { analyzeTurn, languageMismatch, scriptMismatch } from "@/core/compare";
import { teachBackQuestion } from "@/core/question";
import { detectLanguage } from "@/core/language";
import type { Flag, Language, Listener } from "@/core/types";
import { AsrError, asrConfigured, transcribe } from "@/server/asr";
import { listen, metaConfigured, renderEnglish, voiceTranscribe } from "@/server/meta";

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
  const refused = guardRequest(req);
  if (refused) return refused;
  const form = await req.formData();
  const audio = form.get("audio");
  const language = form.get("language") === "om" ? "om" : "am";
  const reference = parseRef(String(form.get("reference") || ""));
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "no_audio" }, { status: 400 });
  if (audio.size > 15 * 1024 * 1024) return NextResponse.json({ error: "audio_too_large" }, { status: 413 });

  const format = (audio.type.split("/")[1] || "webm").split(";")[0];
  const buf = Buffer.from(await audio.arrayBuffer());
  const notes: string[] = [];
  const clientNote = String(form.get("note") || "").trim();
  if (clientNote) notes.push(clientNote.slice(0, 200));

  // Named only once a first listener has actually produced something; null means neither did.
  let firstListener: string | null = null;
  const [asrResult, second] = await Promise.all([
    asrConfigured()
      ? transcribe(audio, language as Language).catch(e => { notes.push(e instanceof AsrError ? `Omnilingual ASR: ${e.hint}` : `Omnilingual ASR failed: ${msg(e)}`); return null; })
      : (notes.push("Omnilingual ASR not configured (ASR_SERVICE_URL)"), Promise.resolve(null)),
    metaConfigured() ? listen(buf, format, language as Language).catch(e => { notes.push(`Second listener failed: ${msg(e)}`); return null; }) : (notes.push("Meta Model API key not configured"), Promise.resolve(null)),
  ]);
  let asr = asrResult;
  if (asr) firstListener = "Listener A (Omnilingual ASR)";
  // Fallback first listener: Meta's hosted Voice Transcribe, when the Space is asleep or absent. Said on the turn, never silently.
  if (!asr && metaConfigured() && process.env.META_VOICE_FALLBACK !== "off") {
    try {
      const v = await voiceTranscribe(buf, format, language as Language);
      if (v.text) { asr = { text: v.text, segments: [], ms: v.ms }; firstListener = "Listener A (Muse Voice Transcribe, fallback)"; notes.push("First listener was Muse Voice Transcribe, whose Amharic and Afaan Oromo coverage is unverified"); }
      else notes.push("Voice Transcribe returned no text");
    } catch (e) { notes.push(`Voice Transcribe failed: ${msg(e)}`); }
  }

  let primary: Listener | null = null;
  if (asr && asr.text && firstListener) {
    let english = "";
    let why = "";
    if (metaConfigured()) {
      try {
        const r = await renderEnglish(asr.text, language as Language);
        english = r.text;
        if (!english) why = ` (finish_reason=${r.finishReason ?? "unknown"}${r.reasoningChars ? `, ${r.reasoningChars} characters of reasoning and no answer` : ""})`;
      }
      catch (e) { notes.push(`Rendering failed: ${msg(e)}`); }
    } else notes.push("No English rendering without the Meta Model API key");
    // No rendering, no listener: an empty primary would turn every fact the second listener heard into a false flag.
    if (english) primary = { name: firstListener, english, facts: extractFacts(english, { reference, language: language as Language }) };
    else if (metaConfigured()) notes.push(`The first listener transcribed but Spark returned no English rendering${why}`);
  }

  let secondary: Listener | undefined;
  if (second?.reply?.english) {
    secondary = { name: "Listener B (Muse Spark)", english: second.reply.english, facts: extractFacts(second.reply.english, { reference, language: language as Language }) };
  } else if (second) {
    // It answered but gave nothing usable. Without this the turn reports no listener and never says why.
    notes.push(second.reply ? "Second listener returned no English rendering" : "Second listener's reply could not be read");
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
  if (second?.reply?.language === "other" && second.reply.confidence >= 0.6) {
    // A third language is as much a mismatch as the other of the two, and the script heuristic cannot see it.
    extra.push({ kind: "language_mismatch", severity: "crit", message: `The second listener heard neither Amharic nor Afaan Oromo (confidence ${Math.round(second.reply.confidence * 100)}%). Check which language the patient is speaking before going on.` });
  } else {
    const mismatch = languageMismatch(language as Language, detected.language, detected.confidence);
    if (mismatch) extra.push(mismatch);
    // Nobody named a language: neither listener nor heuristic. The script can still rule the
    // session language out, and saying nothing here leaves the reviewer believing it was right.
    else if (!detected.language) {
      const script = scriptMismatch(language as Language, second?.reply?.transcript || asr?.text || "");
      if (script) extra.push(script);
    }
  }

  const turn = analyzeTurn(primary, secondary, extra);
  logCall("turn", { language, firstListener, second: Boolean(secondary), asrMs: asr?.ms ?? null, listenMs: second?.ms ?? null, facts: turn.primary.facts.length, flags: turn.flags.length, crit: turn.flags.filter(f => f.severity === "crit").length, notes: notes.length, bytes: audio.size });
  return NextResponse.json({
    language, reference: iso(reference), detected, notes, firstListener,
    transcript: asr?.text ?? "",
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
