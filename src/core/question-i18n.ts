/**
 * The teach-back question in the patient's language, for the interpreter to read aloud.
 * The wording lives in question-templates.json so a native speaker's review can be written back
 * by a script without touching code. They are templates, never model output: nothing a model
 * produced is ever put in front of a patient. The polite second person is used throughout
 * (Amharic እርስዎ, Afaan Oromo isin), because the patient is more often than not older than the
 * interpreter. Until a reviewer signs a language off, the screen shows its questions as drafts.
 */
import templates from "./question-templates.json";
import type { Fact, FactType, Language } from "./types";

export type TemplateSet = { reviewed: boolean; reviewer?: string; reviewedOn?: string; _noSource?: Partial<Record<FactType, string>> } & Record<FactType, string>;
export const TEMPLATES = templates as unknown as { _note?: string } & Record<Language, TemplateSet>;

export const REVIEWED: Record<Language, { reviewed: boolean; by?: string; on?: string }> = {
  am: { reviewed: TEMPLATES.am.reviewed, by: TEMPLATES.am.reviewer, on: TEMPLATES.am.reviewedOn },
  om: { reviewed: TEMPLATES.om.reviewed, by: TEMPLATES.om.reviewer, on: TEMPLATES.om.reviewedOn },
};

export function fillTemplate(template: string, fact: Pick<Fact, "source" | "value">): string {
  return template.replace(/\{source\}/g, fact.source).replace(/\{value\}/g, fact.value);
}

/** The question in the patient's language, with whether a native speaker has reviewed the wording. */
/**
 * The fact's words are always the English rendering, never the patient's own Amharic or Afaan
 * Oromo, so a question in the patient's language must never quote them: "penicillin ነው?" is not a
 * sentence anyone would say to an elder. The quoting wording is kept for the reviewers and for the
 * day the patient's own words are available; the screen uses the wording that quotes nothing.
 */
export function localizedQuestion(fact: Fact, language: Language, opts: { quoteSource?: boolean } = {}): { text: string; reviewed: boolean } {
  const set = TEMPLATES[language];
  const template = opts.quoteSource === true ? set[fact.type] : (set._noSource?.[fact.type] ?? set[fact.type].replace(/\s*[;:]?\s*["“]?\{source\}["”]?\s*[?።]?/g, "").trim());
  return { text: fillTemplate(template, fact), reviewed: set.reviewed };
}
