/**
 * The teach-back question: what the interpreter asks so the patient says the instruction back
 * in their own words. Deterministic templates per fact type. English for now; the Amharic and
 * Afaan Oromo versions arrive after native review, never from a model straight to the patient.
 */
import type { Fact, FactType } from "./types";

/**
 * Which fact to confirm first depends on the room. In a clinic a dose kills fastest; in an
 * immigration interview a date or a count decides the case; in human services the amounts and
 * household numbers do. The order is data, chosen by the interpreter on the screen.
 */
export type Setting = "clinic" | "immigration" | "services";
export const SETTINGS: Record<Setting, { label: string; order: FactType[] }> = {
  clinic: { label: "Clinic", order: ["dose", "frequency", "drug", "negation", "date", "body_part", "duration", "number"] },
  immigration: { label: "Immigration", order: ["date", "negation", "number", "duration", "drug", "dose", "frequency", "body_part"] },
  services: { label: "Human services", order: ["number", "date", "negation", "duration", "dose", "frequency", "drug", "body_part"] },
};
const ORDER: FactType[] = SETTINGS.clinic.order;

/** The English wording, with {source} for the patient's words and {value} for the canonical value. One source for the screen and the review page. */
export const QUESTION_TEMPLATES_EN: Record<FactType, string> = {
  dose: "How much will you take each time? Please tell me in your own words.",
  frequency: "How many times a day will you take it, and when?",
  drug: "Which medicine is this? Please say its name back to me: is it {source}?",
  negation: "I want to be sure I heard you. You said \"{source}\". Is that right?",
  date: "Which date did you mean by \"{source}\"? Which month and year, in the calendar you use?",
  body_part: "Please show me where. Is it the {value}?",
  duration: "For how long? You said \"{source}\".",
  number: "Please say that number again, slowly: {source}?",
};
export function fillQuestion(template: string, f: Pick<Fact, "source" | "value">): string {
  return template.replace(/\{source\}/g, f.source).replace(/\{value\}/g, f.value);
}

/** The question that confirms the most important fact in this turn, or null when there is nothing to confirm. */
export function teachBackQuestion(facts: Fact[], order: FactType[] = ORDER): { question: string; about: Fact } | null {
  for (const type of order) {
    const f = facts.find(x => x.type === type);
    if (f) return { question: fillQuestion(QUESTION_TEMPLATES_EN[type], f), about: f };
  }
  return null;
}
