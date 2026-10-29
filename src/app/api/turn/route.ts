import { NextResponse } from "next/server";
import { guardRequest, logCall } from "@/server/guard";
import { extractFacts } from "@/core/facts";
import { analyzeTurn, languageMismatch, scriptMismatch } from "@/core/compare";
import { teachBackQuestion } from "@/core/question";
import { detectLanguage } from "@/core/language";
import type { Flag, Language, Listener, SpeechLanguage } from "@/core/types";
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
  // language is what this turn is spoken in: the patient's language, "en" when the provider speaks,
  // or "auto" in listening mode, where nobody pressed a button to say who is talking. Then the
  // session language and English are both tried and the listeners decide which it was.
  const raw = String(form.get("language") || "am");
  const sessionLang: Language = String(form.get("session") || raw) === "om" ? "om" : "am";
  const auto = raw === "auto";
  let language: SpeechLanguage = raw === "om" ? "om" : raw === "en" ? "en" : auto ? sessionLang : "am";
  let isEnglish = language === "en";
  const factLanguage: Language = sessionLang;
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
  const asrCall = (lang: SpeechLanguage) => transcribe(audio, lang).catch(e => { notes.push(e instanceof AsrError ? `Omnilingual ASR: ${e.hint}` : `Omnilingual ASR failed: ${msg(e)}`); return null; });
  const [asrResult, asrEnglish, second] = await Promise.all([
    asrConfigured() ? asrCall(language) : (notes.push("Omnilingual ASR not configured (ASR_SERVICE_URL)"), Promise.resolve(null)),
    // Listening mode: the Space is cheap and fast, so it also hears the turn as English, and the one that fits is kept below.
    asrConfigured() && auto ? asrCall("en") : Promise.resolve(null),
    metaConfigured() ? listen(buf, format, auto ? sessionLang : language).catch(e => { notes.push(`Second listener failed: ${msg(e)}`); return null; }) : (notes.push("Meta Model API key not configured"), Promise.resolve(null)),
  ]);
  let asr = asrResult;
  if (auto) {
    // Which language was this? The second listener's word first; else the script of what the Space heard.
    const heard = second?.reply && second.reply.language !== "other" && second.reply.confidence >= 0.5 ? second.reply.language : null;
    const guess = heard ?? (asrResult && detectLanguage(asrResult.text).language === sessionLang ? sessionLang : asrEnglish && /^[\x00-\x7F\s]+$/.test(asrEnglish.text) && asrEnglish.text.split(/\s+/).length >= 2 ? "en" : sessionLang);
    language = guess === "en" ? "en" : sessionLang;
    isEnglish = language === "en";
    if (isEnglish && asrEnglish) asr = asrEnglish;
    notes.push(`Listening mode: heard as ${language === "en" ? "English" : language === "am" ? "Amharic" : "Afaan Oromo"} (${heard ? "second listener" : "script"})`);
  }
  if (asr) firstListener = "Listener A (Omnilingual ASR)";
  // Fallback first listener: Meta's hosted Voice Transcribe, when the Space is asleep or absent. Said on the turn, never silently.
  if (!asr && metaConfigured() && process.env.META_VOICE_FALLBACK !== "off") {
    try {
      const v = await voiceTranscribe(buf, format, language);
      if (v.text) { asr = { text: v.text, segments: [], ms: v.ms }; firstListener = "Listener A (Muse Voice Transcribe, fallback)"; notes.push(isEnglish ? "First listener was Muse Voice Transcribe" : "First listener was Muse Voice Transcribe, whose Amharic and Afaan Oromo coverage is unverified"); }
      else notes.push("Voice Transcribe returned no text");
    } catch (e) { notes.push(`Voice Transcribe failed: ${msg(e)}`); }
  }

  let primary: Listener | null = null;
  if (asr && asr.text && firstListener) {
    let english = "";
    let why = "";
    if (isEnglish) english = asr.text; // the provider spoke English: the transcript is the rendering
    else if (metaConfigured()) {
      try {
        const r = await renderEnglish(asr.text, language);
        english = r.text;
        if (!english) why = ` (${r.model}: finish_reason=${r.finishReason ?? "unknown"}${r.reasoningChars ? `, ${r.reasoningChars} characters of reasoning and no answer` : ""})`;
        else if (r.reasoningChars) notes.push("The reasoning model ran out of tokens; the rendering came from the plain model");
      }
      catch (e) { notes.push(`Rendering failed: ${msg(e)}`); }
    } else notes.push("No English rendering without the Meta Model API key");
    // No rendering, no listener: an empty primary would turn every fact the second listener heard into a false flag.
    if (english) primary = { name: firstListener, english, facts: extractFacts(english, { reference, language: factLanguage }) };
    else if (metaConfigured()) notes.push(`The first listener transcribed but Spark returned no English rendering${why}`);
  }

  let secondary: Listener | undefined;
  if (second?.reply?.english) {
    secondary = { name: "Listener B (Muse Spark)", english: second.reply.english, facts: extractFacts(second.reply.english, { reference, language: factLanguage }) };
  } else if (second) {
    // It answered but gave nothing usable. Without this the turn reports no listener and never says why.
    notes.push(second.reply ? "Second listener returned no English rendering" : "Second listener's reply could not be read");
  }

  // If only the second listener heard anything, it becomes the primary so the screen still has a rendering to mark up.
  if (!primary && secondary) { primary = secondary; secondary = undefined; notes.push("Only the second listener produced a rendering"); }
  // Voice Transcribe's Amharic and Afaan Oromo are unverified and, on the first live turns, poor. When it
  // stood in for the Space and Spark heard the audio itself, Spark leads and the fallback is the cross-check.
  else if (primary && secondary && !isEnglish && firstListener?.includes("fallback")) {
    const fallback = primary; primary = secondary; secondary = fallback;
    notes.push("Spark leads this turn: the first listener was the Voice Transcribe fallback, whose Amharic and Afaan Oromo are unverified");
  }
  if (!primary) return NextResponse.json({ error: "no_listener", notes, transcript: asr?.text ?? "" }, { status: 502 });

  // Language check: the second listener's judgement first, the script heuristic on the transcript as fallback.
  const extra: Flag[] = [];
  let detected: { language: SpeechLanguage | null; confidence: number; by: string } = { language: null, confidence: 0, by: "none" };
  if (second?.reply && second.reply.language !== "other") detected = { language: second.reply.language, confidence: second.reply.confidence, by: "second listener" };
  else {
    const guess = detectLanguage(second?.reply?.transcript || asr?.text || "");
    detected = { ...guess, by: "script heuristic" };
  }
  if (isEnglish) {
    // A provider turn: the only language question is whether the provider was in fact speaking English.
    if (detected.language && detected.language !== "en" && detected.confidence >= 0.6) extra.push({ kind: "language_mismatch", severity: "warn", message: `This was recorded as the provider speaking English, but it sounds like ${detected.language === "am" ? "Amharic" : "Afaan Oromo"}. Check who was speaking.` });
  } else if (second?.reply?.language === "other" && second.reply.confidence >= 0.6) {
    // A third language is as much a mismatch as the other of the two, and the script heuristic cannot see it.
    extra.push({ kind: "language_mismatch", severity: "crit", message: `The second listener heard neither Amharic nor Afaan Oromo (confidence ${Math.round(second.reply.confidence * 100)}%). Check which language the patient is speaking before going on.` });
  } else {
    const mismatch = detected.language === "en"
      ? { kind: "language_mismatch" as const, severity: "crit" as const, message: `The second listener heard English, but this is a patient turn in ${language === "am" ? "Amharic" : "Afaan Oromo"}. If the provider spoke, record it as a provider turn.` }
      : languageMismatch(language, detected.language, detected.confidence);
    if (mismatch) extra.push(mismatch);
    // Nobody named a language: neither listener nor heuristic. The script can still rule the
    // session language out, and saying nothing here leaves the reviewer believing it was right.
    else if (!detected.language) {
      const script = scriptMismatch(sessionLang, second?.reply?.transcript || asr?.text || "");
      if (script) extra.push(script);
    }
  }

  const turn = analyzeTurn(primary, secondary, extra);
  logCall("turn", { language, firstListener, second: Boolean(secondary), asrMs: asr?.ms ?? null, listenMs: second?.ms ?? null, facts: turn.primary.facts.length, flags: turn.flags.length, crit: turn.flags.filter(f => f.severity === "crit").length, notes: notes.length, bytes: audio.size });
  return NextResponse.json({
    language, session: sessionLang, reference: iso(reference), detected, notes, firstListener,
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
