import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cer, runCase, scoreTurn, summarize, type EvalCase } from "./eval";

const cases = JSON.parse(readFileSync(join(__dirname, "..", "..", "eval", "cases", "text-v1.json"), "utf8")) as EvalCase[];

describe("evaluation harness", () => {
  it("scores a planted error as caught only when the right critical flag fires", () => {
    const r = runCase({ id: "x", language: "am", reference: "2026-10-26", a: "Take 500 milligrams.", b: "Take 50 milligrams.", truth: [{ type: "dose", value: "500 mg" }], planted: [{ type: "dose", in: "b" }] });
    expect(r.plantedCaught).toBe(1); expect(r.falseAlarms).toBe(0); expect(r.factsFound).toBe(1);
    const miss = runCase({ id: "y", language: "am", reference: "2026-10-26", a: "Take 500 milligrams.", b: "Take 500 milligrams.", truth: [{ type: "dose", value: "500 mg" }], planted: [{ type: "dose", in: "b" }] });
    expect(miss.plantedCaught).toBe(0); expect(miss.missed).toEqual(["planted dose in b"]);
  });
  it("counts a disagreement nobody planted as a false alarm", () => {
    const r = runCase({ id: "z", language: "am", reference: "2026-10-26", a: "Take 500 milligrams.", b: "Take 50 milligrams.", truth: [{ type: "dose", value: "500 mg" }], planted: [] });
    expect(r.falseAlarms).toBe(1);
  });
  it("the shipped text cases are all clean", () => {
    const results = cases.map(runCase);
    const s = summarize(results);
    const dirty = results.filter(r => r.missed.length || r.falseAlarms).map(r => `${r.id}: ${r.missed.join("; ")}${r.falseAlarms ? ` ${r.falseAlarms} false alarm(s)` : ""}`);
    expect(dirty).toEqual([]);
    expect(s.factRecall).toBe(1);
    expect(s.plantedCaught).toBe(s.plantedTotal);
  });
  it("character error rate counts edits over the reference length", () => {
    expect(cer("ጥቅምት 3", "ጥቅምት 3")).toBe(0);
    expect(cer("abcd", "abxd")).toBe(0.25);
    expect(cer("abcd", "")).toBe(1);
    expect(cer("a  b", "a b")).toBe(0);
  });
  it("scoreTurn scores what a pipeline produced and skipped cases stay out of the totals", () => {
    const c: EvalCase = { id: "s", language: "am", reference: "2026-10-31", truth: [{ type: "dose", value: "500 mg" }], planted: [] };
    const r = scoreTurn(c, [{ type: "dose", value: "500 mg", source: "500 mg", start: 0, end: 6 }], []);
    expect(r.factsFound).toBe(1);
    const s = summarize([r, { ...r, id: "k", factsFound: 0, skipped: "no recording" }]);
    expect(s.cases).toBe(1); expect(s.skipped).toBe(1); expect(s.factRecall).toBe(1);
  });
});
