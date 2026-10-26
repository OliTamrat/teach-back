import { describe, expect, it } from "vitest";
import { extractFacts } from "./facts";
import { analyzeTurn, compareListeners, compareWithLabel, languageMismatch } from "./compare";
import type { Listener } from "./types";

const ref = { year: 2026, month: 10, day: 31 };
const listener = (name: string, english: string): Listener => ({ name, english, facts: extractFacts(english, { reference: ref }) });

describe("two listeners", () => {
  it("agree: no flags", () => {
    const a = listener("ASR", "Take two tablets of 500 milligrams three times a day. I am not allergic to penicillin.");
    const b = listener("Spark", "Take two tablets of 500 mg three times a day. I am not allergic to penicillin.");
    expect(compareListeners(a, b)).toEqual([]);
  });

  it("a dropped 'not' is a critical disagreement", () => {
    const a = listener("ASR", "I am not allergic to penicillin.");
    const b = listener("Spark", "I am allergic to penicillin.");
    const flags = compareListeners(a, b);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ kind: "single_listener", severity: "crit", type: "negation" });
  });

  it("different doses are a critical disagreement naming both", () => {
    const a = listener("ASR", "Take 500 milligrams twice a day.");
    const b = listener("Spark", "Take 50 milligrams twice a day.");
    const flags = compareListeners(a, b);
    const dose = flags.find(f => f.type === "dose")!;
    expect(dose.kind).toBe("listener_disagreement");
    expect(dose.severity).toBe("crit");
    expect(dose.a).toBe("500 milligrams");
    expect(dose.b).toBe("50 milligrams");
    expect(flags.filter(f => f.type === "frequency")).toEqual([]);
  });

  it("left versus right is critical", () => {
    const a = listener("ASR", "The pain is in my left knee.");
    const b = listener("Spark", "The pain is in my right knee.");
    expect(compareListeners(a, b)[0]).toMatchObject({ kind: "listener_disagreement", severity: "crit", type: "body_part" });
  });

  it("a date the second listener converted differently is caught", () => {
    const a = listener("ASR", "The fever started on Tikimt 3.");
    const b = listener("Spark", "The fever started on Tikimt 13.");
    expect(compareListeners(a, b)[0]).toMatchObject({ kind: "listener_disagreement", type: "date" });
  });

  it("an impossible date is flagged even with one listener", () => {
    const a = listener("ASR", "It happened on Pagume 6, 2018.");
    expect(compareListeners(a)[0]).toMatchObject({ kind: "invalid_date", severity: "crit" });
  });

  it("critical flags sort first", () => {
    const a = listener("ASR", "Take 500 milligrams. I have had this cough for three weeks.");
    const b = listener("Spark", "Take 50 milligrams.");
    const { flags } = analyzeTurn(a, b);
    expect(flags[0].severity).toBe("crit");
    expect(flags.at(-1)!.severity).toBe("warn");
  });
});

describe("label check", () => {
  it("spoken 'twice a day' against a label that says once daily", () => {
    const spoken = extractFacts("I take one tablet twice a day.", { reference: ref });
    const label = extractFacts("Take one tablet once a day.", { reference: ref });
    const flags = compareWithLabel(spoken, label);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ kind: "label_conflict", severity: "crit", type: "frequency" });
  });
  it("matching label: nothing to flag", () => {
    const spoken = extractFacts("I take 500 milligrams of metformin twice a day.", { reference: ref });
    const label = extractFacts("Metformin 500 mg, twice a day.", { reference: ref });
    expect(compareWithLabel(spoken, label)).toEqual([]);
  });
});

describe("language mismatch", () => {
  it("flags Afaan Oromo in an Amharic session", () => {
    expect(languageMismatch("am", "om")?.severity).toBe("crit");
    expect(languageMismatch("am", "am")).toBeNull();
    expect(languageMismatch("am", "om", 0.3)).toBeNull();
  });
});
