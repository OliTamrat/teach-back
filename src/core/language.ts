/**
 * Script-and-lexicon language check on a transcript. A fallback for when the second listener
 * cannot say which language it heard: Amharic is written in Ethiopic script, Afaan Oromo in
 * Qubee (Latin) with tell-tale digraphs and function words. Confidence is deliberately coarse.
 */
import type { Language } from "./types";

const OROMO_WORDS = new Set([
  "fi", "kan", "hin", "nan", "koo", "kee", "jira", "jirti", "ture", "qaba", "qabu", "guyyaa", "guyyaatti",
  "yeroo", "booda", "dura", "akka", "keessa", "keessatti", "irraa", "kana", "sana", "ani", "ati", "inni",
  "isheen", "nuti", "isaan", "waan", "garuu", "yookiin", "qofa", "lama", "sadii", "afur", "shan", "tokko",
  "dhukkubbii", "qoricha", "kiniinii", "bishaan", "mana", "ganama", "galgala", "torban", "ji'a", "bara",
]);

export function detectLanguage(text: string): { language: Language | null; confidence: number } {
  const t = text.trim();
  if (!t) return { language: null, confidence: 0 };
  const ethiopic = (t.match(/[ሀ-፿ᎀ-᎟ⶀ-⷟]/g) || []).length;
  const letters = (t.match(/[\p{L}]/gu) || []).length;
  if (letters === 0) return { language: null, confidence: 0 };
  const ethiopicShare = ethiopic / letters;
  if (ethiopicShare > 0.5) return { language: "am", confidence: Math.min(1, 0.6 + ethiopicShare * 0.4) };

  const words = t.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);
  if (!words.length) return { language: null, confidence: 0 };
  const hits = words.filter(w => OROMO_WORDS.has(w)).length;
  const digraphs = (t.match(/dh|ny|ph|ch|sh|'/gi) || []).length;
  const doubles = (t.match(/([aeiou])\1/gi) || []).length; // long vowels: aa, ee, ii, oo, uu
  const score = hits / words.length * 2 + Math.min(0.5, digraphs / words.length) + Math.min(0.5, doubles / words.length);
  if (score >= 0.35) return { language: "om", confidence: Math.min(1, 0.5 + score / 2) };
  if (ethiopicShare > 0.1) return { language: "am", confidence: 0.5 };
  return { language: null, confidence: 0 };
}

/**
 * Whether a transcript cannot be the language the session is set to, on script alone.
 *
 * detectLanguage answers "which language is this" and says null when it cannot tell. The mismatch
 * question is narrower: not "which" but "is this not the expected one", and for Amharic the script
 * settles it — Amharic is written in Ethiopic, so a transcript with none of it is not Amharic
 * whatever else it turns out to be. Only that direction: Afaan Oromo is written in Latin, so Latin
 * text is no evidence against it, and Ethiopic text in an Oromo session is already caught by
 * detectLanguage returning Amharic with confidence.
 *
 * Needs enough letters to be sure. A patient who answers "25 mg" has not said anything in any
 * script, and a flag there would be the crying wolf that teaches a reviewer to ignore the red ones.
 */
export function wrongScriptForSession(expected: Language, text: string): boolean {
  if (expected !== "am") return false;
  const letters = (text.match(/[\p{L}]/gu) || []).length;
  if (letters < 12) return false;
  return (text.match(/[ሀ-፿ᎀ-᎟ⶀ-⷟]/g) || []).length === 0;
}

