import { describe, expect, it } from "vitest";
import { extractFacts } from "./facts";
import { analyzeTurn } from "./compare";
import { allDecided, finalSummary, makeTurn, sessionNotes } from "./session";

const ref = { reference: { year: 2026, month: 10, day: 26 }, language: "am" as const };
const A = "Take two tablets of 500 milligrams three times a day. I am not allergic to penicillin. The fever started on Tikimt 3.";
const B = "Take two tablets of 50 milligrams three times a day. I am allergic to penicillin. The fever started on Tikimt 13.";

function turn() {
  const primary = { name: "A", english: A, facts: extractFacts(A, ref) };
  const secondary = { name: "B", english: B, facts: extractFacts(B, ref) };
  return analyzeTurn(primary, secondary);
}

describe("deciding a turn", () => {
  it("is final only when every flag is decided", () => {
    const t = turn();
    expect(t.flags.length).toBeGreaterThan(1);
    expect(allDecided(t.flags, {})).toBe(false);
    const all = Object.fromEntries(t.flags.map((_, i) => [i, { state: "confirmed" as const }]));
    expect(allDecided(t.flags, all)).toBe(true);
    expect(allDecided(t.flags, { ...all, 0: { state: "open" } })).toBe(false);
  });

  it("writes corrections into the English at the fact's own words", () => {
    const t = turn();
    const dose = t.flags.findIndex(f => f.type === "dose");
    const date = t.flags.findIndex(f => f.type === "date");
    const decisions: Record<number, { state: "confirmed" | "corrected"; correction?: string }> = {};
    t.flags.forEach((_, i) => { decisions[i] = { state: "confirmed" }; });
    decisions[dose] = { state: "corrected", correction: "250 milligrams" };
    decisions[date] = { state: "corrected", correction: "Tikimt 13" };
    const s = finalSummary(A, t.primary.facts, t.flags, decisions);
    expect(s).toContain("two tablets of 250 milligrams");
    expect(s).toContain("started on Tikimt 13.");
    expect(s).toContain("not allergic");
    expect(s).not.toContain("500");
  });

  it("puts a correction it cannot place in the text at the end as a note", () => {
    const flags = [{ kind: "language_mismatch" as const, severity: "crit" as const, message: "x" }];
    expect(finalSummary("I feel fine.", [], flags, { 0: { state: "corrected", correction: "patient spoke Afaan Oromo" } }))
      .toBe("I feel fine. (Reviewer: patient spoke Afaan Oromo)");
  });

  it("confirmed flags leave the line unchanged", () => {
    const t = turn();
    const all = Object.fromEntries(t.flags.map((_, i) => [i, { state: "confirmed" as const }]));
    expect(finalSummary(A, t.primary.facts, t.flags, all)).toBe(A);
  });
});

describe("session notes", () => {
  it("lists each turn with what was confirmed and corrected", () => {
    const t = turn();
    const decisions = t.flags.map((f) => f.type === "dose" ? { state: "corrected" as const, correction: "250 milligrams" } : { state: "confirmed" as const });
    const rec = makeTurn({ language: "am", reference: "2026-10-26", english: A, facts: t.primary.facts, flags: t.flags, decisions, at: new Date("2026-10-26T14:05:00Z") });
    expect(rec.summary).toContain("250 milligrams");
    const notes = sessionNotes([rec], new Date("2026-10-26T15:00:00Z"));
    expect(notes).toContain("1. [14:05] Patient, Amharic: Take two tablets of 250 milligrams");
    expect(notes).toContain('corrected: dose "500 milligrams" -> "250 milligrams"');
    expect(notes).toContain("confirmed: date");
    expect(notes).toContain("not medical advice");
  });

  it("a correction inside a corrected outer span is kept as a note, not overwritten", () => {
    const english = "I do not take two tablets of metformin.";
    const facts = extractFacts(english, ref);
    const neg = facts.findIndex(f => f.type === "negation"), dose = facts.findIndex(f => f.type === "dose"), drug = facts.findIndex(f => f.type === "drug");
    expect(neg).toBeGreaterThanOrEqual(0); expect(dose).toBeGreaterThanOrEqual(0); expect(drug).toBeGreaterThanOrEqual(0);
    const flags = [neg, dose, drug].map(i => ({ kind: "listener_disagreement" as const, severity: "crit" as const, type: facts[i].type, message: "", factIndex: i }));
    const out = finalSummary(english, facts, flags, { 0: { state: "corrected", correction: "I take" }, 1: { state: "corrected", correction: "one tablet" }, 2: { state: "corrected", correction: "glipizide" } });
    expect(out.startsWith("I I take.")).toBe(true);
    expect(out).toContain('dose "two tablets" corrected to "one tablet"');
    expect(out).toContain('drug "metformin" corrected to "glipizide"');
    // inner corrections alone are placed normally
    const inner = finalSummary(english, facts, flags, { 1: { state: "corrected", correction: "one tablet" }, 2: { state: "corrected", correction: "glipizide" } });
    expect(inner).toBe("I do not take one tablet of glipizide.");
  });
});

