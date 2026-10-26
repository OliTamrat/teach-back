import { describe, expect, it } from "vitest";
import { extractFacts } from "./facts";
import { teachBackQuestion } from "./question";
import { REVIEWED, localizedQuestion } from "./question-i18n";

describe("localized teach-back questions", () => {
  const facts = extractFacts("Take two tablets of 500 milligrams. I am not allergic to penicillin. The fever started on Tikimt 3.", { reference: { year: 2026, month: 10, day: 31 } });
  it("exist for every fact type in both languages and carry the source words where the English does", () => {
    for (const f of facts) {
      for (const lang of ["am", "om"] as const) {
        const q = localizedQuestion(f, lang);
        expect(q.text.length).toBeGreaterThan(10);
        if (f.type === "negation" || f.type === "date") expect(q.text).toContain(f.source);
      }
    }
  });
  it("Amharic questions are in Ethiopic script; Afaan Oromo in Latin", () => {
    const f = teachBackQuestion(facts)!.about;
    expect(localizedQuestion(f, "am").text).toMatch(/[ሀ-፿]/);
    expect(localizedQuestion(f, "om").text).not.toMatch(/[ሀ-፿]/);
  });
  it("is marked unreviewed until a native speaker signs it off", () => {
    expect(REVIEWED.am.reviewed).toBe(false);
    expect(REVIEWED.om.reviewed).toBe(false);
    expect(localizedQuestion(facts[0], "am").reviewed).toBe(false);
  });
});
