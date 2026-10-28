import { describe, expect, it } from "vitest";
import { extractFacts } from "./facts";
import { analyzeTurn, compareListeners, compareWithLabel, compareWithSource, languageMismatch, scriptMismatch } from "./compare";
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

    // A language nobody could name is still not Amharic if nothing in it is Ethiopic.
    expect(scriptMismatch("am", "take two tablets twice a day for five days")?.severity).toBe("crit");
    expect(scriptMismatch("am", "ሁለት ኪኒን በቀን ሁለት ጊዜ ለአምስት ቀናት ይውሰዱ")).toBeNull();
    // Afaan Oromo is written in Latin, so Latin text says nothing against an Oromo session.
    expect(scriptMismatch("om", "kiniinii lama guyyaatti yeroo lama")).toBeNull();
    // Too little to be sure: a dose on its own is not written in any script.
    expect(scriptMismatch("am", "25 mg")).toBeNull();
    expect(scriptMismatch("am", "")).toBeNull();
    // One Ethiopic word is enough to stop it: the claim is "none of it", not "most of it".
    expect(scriptMismatch("am", "take two tablets ኪኒን twice a day for five days")).toBeNull();
  });
});

describe("label comparison matches like with like (found by the Day 5 walkthrough)", () => {
  const opts = { reference: { year: 2026, month: 10, day: 27 } };
  it("a tablet count is compared with the label's count, not its strength", () => {
    const spoken = extractFacts("The doctor told me to take two tablets of 500 milligrams three times a day.", opts);
    const label = extractFacts("Metformin 500 mg Take one tablet twice a day with food.", opts);
    const flags = compareWithLabel(spoken, label);
    const dose = flags.filter(f => f.type === "dose");
    expect(dose).toHaveLength(1);
    expect(dose[0]).toMatchObject({ a: "two tablets", b: "one tablet" });
    expect(flags.some(f => f.type === "frequency" && f.a === "three times a day" && f.b === "twice a day")).toBe(true);
  });
  it("a strength that matches raises nothing even when the label also carries a count", () => {
    const spoken = extractFacts("I take 500 milligrams.", opts);
    const label = extractFacts("Metformin 500 mg. Take one tablet daily.", opts);
    expect(compareWithLabel(spoken, label)).toEqual([]);
  });
});

describe("dose kinds use the canonical units (Day 10 review)", () => {
  const opts = { reference: { year: 2026, month: 10, day: 27 } };
  it("a teaspoon is an amount and is not set against a count", () => {
    const spoken = extractFacts("One teaspoon twice a day.", opts);
    const label = extractFacts("Take 5 ml twice a day.", opts);
    expect(compareWithLabel(spoken, label)).toEqual([]); // a metric teaspoon is 5 ml
    expect(compareWithLabel(extractFacts("Two teaspoons twice a day.", opts), label).some(f => f.type === "dose")).toBe(true);
    expect(compareWithLabel(extractFacts("I take 1 gram.", opts), extractFacts("1000 mg", opts))).toEqual([]);
    const agree = compareWithLabel(extractFacts("Take two tablets.", opts), extractFacts("500 mg. Take two tablets.", opts));
    expect(agree).toEqual([]);
  });
});

describe("one listener is never a clean turn (Oct 28)", () => {
  const opts = { reference: { year: 2026, month: 10, day: 28 } };
  it("raises an unverified warning when there is no second listener and there are facts", () => {
    const a = { name: "Listener B (Muse Spark)", english: "Five hundred milligrams amoxicillin twice a day.", facts: extractFacts("Five hundred milligrams amoxicillin twice a day.", opts) };
    const flags = compareListeners(a);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ kind: "unverified", severity: "warn" });
    expect(flags[0].message).toContain("Muse Spark");
    expect(compareListeners({ name: "A", english: "Hello.", facts: [] })).toEqual([]);
  });
});

describe("the interpreter check: what the provider said against what the interpreter rendered", () => {
  const opts = { reference: { year: 2026, month: 10, day: 28 } };
  const provider = "Take one tablet of 500 milligrams amoxicillin three times a day for ten days. Do not take it with milk.";
  it("carries a faithful rendering through with no flags", () => {
    const src = extractFacts(provider, opts);
    const faithful = extractFacts("Take one tablet of 500 milligrams of amoxicillin three times a day for ten days. Do not take it with milk.", opts);
    expect(compareWithSource(src, faithful)).toEqual([]);
  });
  it("a changed dose and a dropped prohibition are critical, an added phrase is a warning", () => {
    const src = extractFacts(provider, opts);
    const rendered = extractFacts("Take one tablet of 50 milligrams amoxicillin three times a day for ten days. Take it with milk and with food.", opts);
    const flags = compareWithSource(src, rendered);
    expect(flags.find(f => f.kind === "interpreter_changed" && f.type === "dose")).toMatchObject({ severity: "crit", a: "500 milligrams", b: "50 milligrams" });
    expect(flags.find(f => f.kind === "interpreter_dropped" && f.type === "negation")).toMatchObject({ severity: "crit", a: "Do not take it with milk" });
    expect(flags.find(f => f.kind === "interpreter_added" && f.type === "frequency")).toMatchObject({ severity: "warn", b: "with food" });
    expect(flags.filter(f => f.severity === "crit")).toHaveLength(2);
  });
  it("works the other way too: the patient's symptoms against the interpreter's English", () => {
    const patient = extractFacts("I have a sharp pain in my lower right back for three weeks. I am not allergic to penicillin.", opts);
    const interpreter = extractFacts("He has pain in his lower left back for three weeks. He is allergic to penicillin.", opts);
    const flags = compareWithSource(patient, interpreter);
    expect(flags.map(f => `${f.kind}:${f.type}`).sort()).toEqual(["interpreter_changed:body_part", "interpreter_changed:symptom", "interpreter_dropped:negation"]);
  });
});

