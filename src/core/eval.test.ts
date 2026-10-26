import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runCase, summarize, type EvalCase } from "./eval";

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
});
