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
