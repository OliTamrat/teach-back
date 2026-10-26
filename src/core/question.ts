/**
 * The teach-back question: what the interpreter asks so the patient says the instruction back
 * in their own words. Deterministic templates per fact type. English for now; the Amharic and
 * Afaan Oromo versions arrive after native review, never from a model straight to the patient.
 */
import type { Fact, FactType } from "./types";

const ORDER: FactType[] = ["dose", "frequency", "drug", "negation", "date", "body_part", "duration"];

const TEMPLATES: Record<FactType, (f: Fact) => string> = {
  dose: () => "How much will you take each time? Please tell me in your own words.",
  frequency: () => "How many times a day will you take it, and when?",
  drug: f => `Which medicine is this? Please say its name back to me: is it ${f.source}?`,
  negation: f => `I want to be sure I heard you. You said "${f.source}". Is that right?`,
  date: f => `Which date did you mean by "${f.source}"? Which month and year, in the calendar you use?`,
  body_part: f => `Please show me where. Is it the ${f.value}?`,
  duration: f => `For how long? You said "${f.source}".`,
};

/** The question that confirms the most important fact in this turn, or null when there is nothing to confirm. */
export function teachBackQuestion(facts: Fact[]): { question: string; about: Fact } | null {
  for (const type of ORDER) {
    const f = facts.find(x => x.type === type);
    if (f) return { question: TEMPLATES[type](f), about: f };
  }
  return null;
}
