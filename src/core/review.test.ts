import { describe, expect, it } from "vitest";
import { applyReview, type ReviewFile, type Script, type Templates } from "./review";

const script: Script = { items: [
  { id: "S01", spoken: "am", text: "draft am", reviewed: false },
  { id: "S02", spoken: "om", text: "draft om", reviewed: false },
  { id: "S03", spoken: "am", text: "draft am 3", reviewed: false },
] };
const templates: Templates = {
  am: { reviewed: false, dose: "d", frequency: "f", drug: "g", negation: "n", body_part: "b", date: "t", duration: "u", number: "m" },
  om: { reviewed: false, dose: "d", frequency: "f", drug: "g", negation: "n", body_part: "b", date: "t", duration: "u", number: "m" },
};
const base: ReviewFile = { reviewer: "Reviewer A", language: "am", on: "2026-10-31", sentences: [], templates: [] };

describe("applying a native review", () => {
  it("a change replaces the draft, an approval keeps it, untouched stays a draft", () => {
    const r = applyReview(script, templates, { ...base, sentences: [{ id: "S01", state: "changed", text: " better am " }, { id: "S03", state: "approved", note: "fine" }] });
    expect(r.script.items[0]).toMatchObject({ text: "better am", reviewed: true, reviewer: "Reviewer A", reviewedOn: "2026-10-31" });
    expect(r.script.items[2]).toMatchObject({ text: "draft am 3", reviewed: true, reviewNote: "fine" });
    expect(r.script.items[1].reviewed).toBe(false);
    expect(r.applied.sentences).toBe(2); expect(r.problems).toEqual([]);
  });
  it("refuses a sentence in the other language and a change with no text, and names them", () => {
    const r = applyReview(script, templates, { ...base, sentences: [{ id: "S02", state: "approved" }, { id: "S01", state: "changed" }, { id: "S99", state: "approved" }] });
    expect(r.script.items[1].reviewed).toBe(false);
    expect([...r.problems].sort()).toEqual(["S01 marked changed with no text", "S02 is om, review is am", "unknown sentence S99"]);
  });
  it("a language's templates are reviewed only when every one has been", () => {
    const partial = applyReview(script, templates, { ...base, templates: [{ id: "dose", state: "changed", text: "new dose" }] });
    expect(partial.templates.am.dose).toBe("new dose");
    expect(partial.templates.am.reviewed).toBe(false);
    const all = applyReview(script, templates, { ...base, templates: ["dose", "frequency", "drug", "negation", "body_part", "date", "duration", "number"].map(id => ({ id, state: "approved" as const })) });
    expect(all.templates.am).toMatchObject({ reviewed: true, reviewer: "Reviewer A" });
    expect(all.templates.om.reviewed).toBe(false);
  });
  it("does not mutate its inputs", () => {
    applyReview(script, templates, { ...base, sentences: [{ id: "S01", state: "changed", text: "x" }], templates: [{ id: "dose", state: "changed", text: "y" }] });
    expect(script.items[0].text).toBe("draft am"); expect(templates.am.dose).toBe("d");
  });
});
