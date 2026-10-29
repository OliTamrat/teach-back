import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cer, resultsMarkdown, resultsSentence, runCase, scoreTurn, summarize, type EvalCase } from "./eval";

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
  it("results text is honest before any audio has run, and per language after", () => {
    const text = summarize(cases.map(runCase));
    expect(resultsMarkdown(text, "2026-10-27T00:00:00Z")).toContain("No audio cases have run yet");
    expect(resultsSentence(text)).toBeNull();
    const am = { ...runCase(cases[0]), language: "am" as const, audio: true, cer: 0.06 };
    const om = { ...runCase(cases[0]), language: "om" as const, audio: true, cer: 0.1 };
    const textCase = { ...runCase(cases[0]), id: "text-am", language: "am" as const, audio: false };
    const s = summarize([am, om, textCase, { ...am, id: "skip", skipped: "no recording" }]);
    s.speakers = 4;
    s.visits = { text: { takes: 8, rolesRight: 32, rolesTotal: 32, plantedCaught: 7, plantedTotal: 7, falseAlarms: 0 }, audio: { takes: 8, rolesRight: 30, rolesTotal: 32, plantedCaught: 6, plantedTotal: 7, falseAlarms: 1 } };
    expect(s.byLanguage.map(l => [l.language, l.cases, l.meanCer])).toEqual([["am", 1, 0.06], ["om", 1, 0.1]]);
    const md = resultsMarkdown(s, "2026-11-01T10:00:00Z");
    expect(md).toContain("| Transcript character error rate (Omnilingual ASR) | 6% | 10% |");
    expect(md).toContain("from 4 speakers");
    expect(resultsSentence(s)).toBe("4 speakers, 2 clips, character error rate of 6% in Amharic and 10% in Afaan Oromo; 3 of 3 planted errors caught, 0 false alarms. In scripted two-way visits, 6 of 7 planted interpreter errors were flagged.");
    expect(resultsMarkdown(s, "2026-11-01T10:00:00Z")).toContain("6 of 7 planted interpreter errors flagged, 1 false alarm on faithful lines, roles from the alternation rule right 30 of 32");
  });
});
