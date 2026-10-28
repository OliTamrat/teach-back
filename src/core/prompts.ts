/**
 * What the models are asked. Pure and exported so the exact wording is testable without a key.
 * The models render; code decides. No prompt here asks a model to advise, diagnose, or convert
 * a date.
 */
import type { Language, SpeechLanguage } from "./types";
import { NEGATION_CUE } from "./facts";

export const LANGUAGE_NAME: Record<SpeechLanguage, string> = { am: "Amharic", om: "Afaan Oromo", en: "English" };

/** First listener: turn the ASR transcript into a faithful English rendering. */
export function renderPrompt(transcript: string, language: SpeechLanguage): string {
  return [
    `A patient in a clinic said the following in ${LANGUAGE_NAME[language]}. Render it in English for a medical interpreter.`,
    "Rules: translate faithfully; keep every number, unit, drug name, negation, body part and side exactly as said;",
    "keep any Ethiopian-calendar date exactly as spoken (month name and day, and year if given) without converting it;",
    "do not add, infer, summarise or advise. Reply with the English rendering only.",
    "",
    transcript,
  ].join("\n");
}

/** Second listener: hear the audio directly and report, as JSON, what was said and in which language. */
export function listenPrompt(expected: SpeechLanguage): string {
  return [
    expected === "en"
      ? "This audio is a clinician or caseworker speaking English to a patient through an interpreter."
      : `This audio is a patient speaking in a clinic. The session expects ${LANGUAGE_NAME[expected]}, but the patient may be speaking Amharic or Afaan Oromo.`,
    "Reply with JSON only, no prose, with exactly these keys:",
    '{"language":"am"|"om"|"en"|"other","confidence":0..1,"transcript":"<what was said, in its own script>","english":"<faithful English rendering; the transcript itself when the speech is English>"}',
    "confidence is how sure you are of the language, never of the rendering: a voice you are certain is neither Amharic nor Afaan Oromo is \"other\" with high confidence, not low.",
    "Rules for the English: keep every number, unit, drug name, negation, body part and side exactly as said;",
    "keep any Ethiopian-calendar date exactly as spoken without converting it; do not add, infer, summarise or advise.",
    "If the speech is in some other language, still say \"other\" with your confidence in that, and still fill transcript and english if you can make them out.",
    "Only if you can make out no speech at all, set transcript and english to empty strings and confidence to 0.",
  ].join("\n");
}

export type ListenReply = { language: "am" | "om" | "en" | "other"; confidence: number; transcript: string; english: string };

/** Parse the second listener's reply, tolerating code fences and stray prose around the JSON. */
export function parseListenReply(raw: string): ListenReply | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as Partial<ListenReply>;
    const language = j.language === "am" || j.language === "om" || j.language === "en" ? j.language : "other";
    const confidence = typeof j.confidence === "number" ? Math.max(0, Math.min(1, j.confidence)) : 0;
    return { language, confidence, transcript: String(j.transcript ?? "").trim(), english: String(j.english ?? "").trim() };
  } catch {
    return null;
  }
}

/** Label reader: Spark looks at the (cropped) photo of a medication label and reports what is printed, as JSON. */
export function labelReadPrompt(): string {
  return [
    "This is a photo of a medication label. Report only what is printed on it, as JSON, no prose, with exactly these keys:",
    '{"legible":true|false,"drug":"<name as printed, or empty>","strength":"<e.g. 500 mg, or empty>","instructions":"<every direction to the patient as printed - how much, how often, how long, and anything they must not do - or empty>","text":"<all legible text, in reading order>"}',
    "Rules: copy numbers, units and names exactly as printed; do not correct, infer, expand abbreviations or add anything that is not visible;",
    "if the label is unreadable, set legible to false and the other fields to empty strings.",
  ].join("\n");
}

export type LabelReply = { legible: boolean; drug: string; strength: string; instructions: string; text: string };

export function parseLabelReply(raw: string): LabelReply | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as Partial<LabelReply>;
    const str = (v: unknown) => String(v ?? "").trim();
    return { legible: Boolean(j.legible), drug: str(j.drug), strength: str(j.strength), instructions: str(j.instructions), text: str(j.text) };
  } catch {
    return null;
  }
}

/** The label as one English line for the fact extractor: drug, strength, then the directions. */
export function labelAsText(l: LabelReply): string {
  const head = [l.drug, l.strength, l.instructions].filter(Boolean).join(" ").trim();
  if (!head) return l.text;
  // Drug, strength and directions are preferred over all the legible text, because a label also
  // carries counts and lot numbers that would be compared against things the patient never had to
  // say. A prohibition is the exception: "Do not take with milk" is a direction, the model prints
  // it outside the directions sentence often enough, and dropping it leaves the reviewer working
  // from a label that says less than the label does. It cannot raise a false conflict either:
  // compareWithLabel weighs dose, frequency and drug, never a negation.
  const printed = (l.text || "").split(/(?<=[.!?])\s+|\n+/).map(t => t.trim());
  const missing = printed.filter(t => t && NEGATION_CUE.test(t) && !head.includes(t));
  return [head, ...missing].join(" ").trim();
}
