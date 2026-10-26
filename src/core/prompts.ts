/**
 * What the models are asked. Pure and exported so the exact wording is testable without a key.
 * The models render; code decides. No prompt here asks a model to advise, diagnose, or convert
 * a date.
 */
import type { Language } from "./types";

export const LANGUAGE_NAME: Record<Language, string> = { am: "Amharic", om: "Afaan Oromo" };

/** First listener: turn the ASR transcript into a faithful English rendering. */
export function renderPrompt(transcript: string, language: Language): string {
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
export function listenPrompt(expected: Language): string {
  return [
    `This audio is a patient speaking in a clinic. The session expects ${LANGUAGE_NAME[expected]}, but the patient may be speaking Amharic or Afaan Oromo.`,
    "Reply with JSON only, no prose, with exactly these keys:",
    '{"language":"am"|"om"|"other","confidence":0..1,"transcript":"<what was said, in its own script>","english":"<faithful English rendering>"}',
    "Rules for the English: keep every number, unit, drug name, negation, body part and side exactly as said;",
    "keep any Ethiopian-calendar date exactly as spoken without converting it; do not add, infer, summarise or advise.",
    "If you cannot understand the audio, set transcript and english to empty strings and confidence to 0.",
  ].join("\n");
}

export type ListenReply = { language: "am" | "om" | "other"; confidence: number; transcript: string; english: string };

/** Parse the second listener's reply, tolerating code fences and stray prose around the JSON. */
export function parseListenReply(raw: string): ListenReply | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as Partial<ListenReply>;
    const language = j.language === "am" || j.language === "om" ? j.language : "other";
    const confidence = typeof j.confidence === "number" ? Math.max(0, Math.min(1, j.confidence)) : 0;
    return { language, confidence, transcript: String(j.transcript ?? "").trim(), english: String(j.english ?? "").trim() };
  } catch {
    return null;
  }
}
