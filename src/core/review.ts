/**
 * Native review, written back. A reviewer works through the recording script and the question
 * templates on /review and downloads one JSON file; this applies it. Pure, so the merge rules are
 * tested: a reviewer's change replaces the draft, an approval keeps it, anything untouched stays
 * a draft, and a language's templates count as reviewed only when every one of them has been.
 */
import type { FactType, Language } from "./types";

export type ReviewItem = { id: string; state: "approved" | "changed"; text?: string; note?: string };
export type ReviewFile = {
  reviewer: string;
  language: Language;
  on: string;             // ISO date
  sentences: ReviewItem[]; // ids from recording-script.json
  templates: ReviewItem[]; // ids are fact types
};

export type ScriptItem = { id: string; spoken: string; text: string; reviewed: boolean; reviewer?: string; reviewedOn?: string; reviewNote?: string; [k: string]: unknown };
export type Script = { items: ScriptItem[]; [k: string]: unknown };
export type Templates = Record<Language, { reviewed: boolean; reviewer?: string; reviewedOn?: string } & Record<FactType, string>> & { _note?: string };

export const FACT_TYPES: FactType[] = ["dose", "frequency", "drug", "negation", "body_part", "date", "duration", "number", "symptom"];

export function applyReview(script: Script, templates: Templates, review: ReviewFile): { script: Script; templates: Templates; applied: { sentences: number; templates: number; languageReviewed: boolean }; problems: string[] } {
  const problems: string[] = [];
  if (!review.reviewer?.trim()) problems.push("review has no reviewer name");
  const byId = new Map(review.sentences.map(r => [r.id, r]));
  let sentences = 0;
  const items = script.items.map(it => {
    const r = byId.get(it.id);
    if (!r) return it;
    if (it.spoken !== review.language) { problems.push(`${it.id} is ${it.spoken}, review is ${review.language}`); return it; }
    if (r.state === "changed" && !r.text?.trim()) { problems.push(`${it.id} marked changed with no text`); return it; }
    sentences++;
    return { ...it, text: r.state === "changed" ? r.text!.trim() : it.text, reviewed: true, reviewer: review.reviewer, reviewedOn: review.on, ...(r.note ? { reviewNote: r.note } : {}) };
  });
  for (const r of review.sentences) if (!script.items.some(it => it.id === r.id)) problems.push(`unknown sentence ${r.id}`);

  const t = { ...templates, [review.language]: { ...templates[review.language] } } as Templates;
  const set = t[review.language];
  let tcount = 0;
  const done = new Set<string>();
  for (const r of review.templates) {
    if (!FACT_TYPES.includes(r.id as FactType)) { problems.push(`unknown template ${r.id}`); continue; }
    if (r.state === "changed") {
      if (!r.text?.trim()) { problems.push(`template ${r.id} marked changed with no text`); continue; }
      set[r.id as FactType] = r.text.trim();
    }
    done.add(r.id); tcount++;
  }
  const languageReviewed = FACT_TYPES.every(ft => done.has(ft));
  if (languageReviewed) { set.reviewed = true; set.reviewer = review.reviewer; set.reviewedOn = review.on; }
  return { script: { ...script, items }, templates: t, applied: { sentences, templates: tcount, languageReviewed }, problems };
}
