import { describe, expect, it } from "vitest";
import { extractFacts } from "./facts";
import { placeTurn, relabel, sourceRun, turnFlags, type ConversationTurn } from "./conversation";

const opts = { reference: { year: 2026, month: 10, day: 29 }, language: "am" as const };
function mk(id: string, language: "am" | "om" | "en", english: string, listenerFlags = []) {
  return { id, at: "2026-10-29T10:00:00Z", language, english, transcript: english, facts: extractFacts(english, opts), listenerFlags };
}

describe("a visit, turn by turn, with no buttons", () => {
  it("labels roles by alternation and checks every rendering against the turn before it", () => {
    const turns: ConversationTurn[] = [];
    const add = (t: ReturnType<typeof mk>) => { const placed = placeTurn(turns, t, "am"); turns.push(placed); return placed; };
    const t1 = add(mk("1", "am", "I have a sharp pain in my lower right back for three weeks. I am not allergic to penicillin."));
    expect(t1.role).toBe("patient"); expect(t1.interpreterFlags).toEqual([]);
    const t2 = add(mk("2", "en", "She has a sharp pain in her lower right back for three weeks. She is allergic to penicillin."));
    expect(t2.role).toBe("interpreter_to_provider"); expect(t2.rendersId).toBe("1");
    expect(t2.interpreterFlags.map(f => `${f.kind}:${f.type}`)).toEqual(["interpreter_dropped:negation"]);
    const t3 = add(mk("3", "en", "Take one tablet of 500 milligrams amoxicillin three times a day. Do not take it with milk."));
    expect(t3.role).toBe("provider"); expect(t3.interpreterFlags).toEqual([]); // same language: the provider going on
    const t4 = add(mk("4", "am", "Take one tablet of 50 milligrams amoxicillin three times a day. Do not take it with milk."));
    expect(t4.role).toBe("interpreter_to_patient"); expect(t4.rendersId).toBe("3");
    expect(t4.interpreterFlags).toHaveLength(1);
    expect(t4.interpreterFlags[0]).toMatchObject({ kind: "interpreter_changed", type: "dose", a: "500 milligrams", b: "50 milligrams" });
    expect(t4.interpreterFlags[0].message).toContain("the interpreter, to the patient,");
  });
  it("the first turn in English is the provider, and Afaan Oromo sessions work the same way", () => {
    const first = placeTurn(undefined, mk("1", "en", "How long have you had the cough?"), "om");
    expect(first.role).toBe("provider");
    const second = placeTurn(first, mk("2", "om", "How long have you had the cough?"), "om");
    expect(second.role).toBe("interpreter_to_patient"); expect(second.interpreterFlags).toEqual([]);
  });
  it("interpreter flags come first for the reviewer", () => {
    const t = { ...mk("1", "am", "x"), role: "patient" as const, interpreterFlags: [{ kind: "interpreter_dropped" as const, severity: "crit" as const, message: "a" }], listenerFlags: [{ kind: "single_listener" as const, severity: "warn" as const, message: "b" }, { kind: "listener_disagreement" as const, severity: "crit" as const, message: "c" }] };
    expect(turnFlags(t).map(f => f.message)).toEqual(["a", "c", "b"]);
  });

  it("a sentence split by a pause is still checked whole", () => {
    const turns: ConversationTurn[] = [];
    const add = (t: ReturnType<typeof mk>) => { const placed = placeTurn(turns, t, "am"); turns.push(placed); return placed; };
    add(mk("1", "en", "Take two tablets"));
    add(mk("2", "en", "of 500 milligrams, three times a day."));
    expect(sourceRun(turns, "am").map(t => t.id)).toEqual(["1", "2"]);
    const r = add(mk("3", "am", "Take one tablet of 500 milligrams three times a day."));
    expect(r.rendersId).toBe("1+2");
    expect(r.interpreterFlags.map(f => `${f.kind}:${f.type}:${f.a}`)).toEqual(["interpreter_changed:dose:two tablets"]);
  });

  it("a person can relabel a turn and every later pairing is recomputed", () => {
    const turns: ConversationTurn[] = [];
    const add = (t: ReturnType<typeof mk>) => { const placed = placeTurn(turns, t, "am"); turns.push(placed); return placed; };
    add(mk("1", "am", "I have had a fever for two days."));
    add(mk("2", "en", "She has had a fever for two days."));
    add(mk("3", "en", "Take one tablet of paracetamol twice a day."));
    add(mk("4", "am", "Take one tablet of paracetamol twice a day."));
    // The provider spoke some Amharic in turn 4: it is not the interpreter, so nothing is rendered or checked.
    const fixed = relabel(turns, "4", { role: "provider" }, "am");
    expect(fixed[3]).toMatchObject({ role: "provider", interpreterFlags: [], forcedRole: "provider" });
    // Force turn 2 to be the patient continuing in English (a bilingual patient): it renders nothing, and turn 3 is still the provider.
    const again = relabel(turns, "2", { role: "patient" }, "am");
    expect(again[1].role).toBe("patient"); expect(again[1].interpreterFlags).toEqual([]);
    expect(again[2].role).toBe("provider");
    expect(again[3].role).toBe("interpreter_to_patient"); expect(again[3].rendersId).toBe("3");
  });

  it("forcing an interpreter role next to a rendering checks against the real source, never an empty run", () => {
    const turns: ConversationTurn[] = [];
    const add = (t: ReturnType<typeof mk>) => { const placed = placeTurn(turns, t, "am"); turns.push(placed); return placed; };
    add(mk("1", "en", "Take one tablet of 500 milligrams."));
    add(mk("2", "am", "Take one tablet of 500 milligrams."));
    add(mk("3", "en", "Take one tablet of 50 milligrams."));
    const forced = relabel(turns, "3", { role: "interpreter_to_provider" }, "am");
    // turn 3 follows a rendering; forced to be an interpreter it must not be checked against nothing
    expect(forced[2].interpreterFlags.filter(f => f.kind === "interpreter_added")).toEqual([]);
  });
});

