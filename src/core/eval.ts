/**
 * Scoring for the evaluation harness. A case is a turn with known truth: the critical facts the
 * patient actually stated, and the errors deliberately planted in one listener's rendering. The
 * system is scored on two questions judges care about: did it find the facts, and did it flag
 * the planted errors without crying wolf. Pure, so the same scorer runs over text cases today and
 * over real recordings once they exist.
 */
import { extractFacts } from "./facts";
import { analyzeTurn, compareWithLabel, languageMismatch } from "./compare";
import type { FactType, Flag, Language } from "./types";

export type EvalCase = {
  id: string;
  language: Language;
  /** ISO date the words were spoken; Ethiopian dates resolve against it. */
  reference: string;
  /** What the patient said, for the record. Not scored. */
  said?: string;
  /** Listener A's English rendering. */
  a: string;
  /** Listener B's English rendering, if two listeners heard the turn. */
  b?: string;
  /** Medication label text, if a label was read. */
  label?: string;
  /** Language the second listener detected, if any. */
  spoken?: Language;
  /** The critical facts the patient actually stated, as the extractor's canonical values. */
  truth: Array<{ type: FactType; value: string }>;
  /** Errors planted in a rendering, each of which should produce a critical flag of this type. */
  planted: Array<{ type: FactType; in: "a" | "b" | "label" }>;
  /** Flag kinds the case must raise that are not about a planted fact (a language mismatch, an invalid date). */
  expectFlags?: Flag["kind"][];
};

export type CaseResult = {
  id: string;
  factsFound: number;    // truth facts the extractor found in listener A's rendering
  factsTotal: number;
  factsExtra: number;    // facts extracted that are not in the truth (noise)
  plantedCaught: number; // planted errors that produced a critical flag of the right type
  plantedTotal: number;
  expectedCaught: number;
  expectedTotal: number;
  falseAlarms: number;   // critical flags on facts where no error was planted
  flags: Flag[];
  missed: string[];
};

export function runCase(c: EvalCase): CaseResult {
  const [y, m, d] = c.reference.split("-").map(Number);
  const opts = { reference: { year: y, month: m, day: d }, language: c.language };
  const primary = { name: "A", english: c.a, facts: extractFacts(c.a, opts) };
  const secondary = c.b ? { name: "B", english: c.b, facts: extractFacts(c.b, opts) } : undefined;
  const extra: Flag[] = [];
  const mismatch = languageMismatch(c.language, c.spoken ?? null);
  if (mismatch) extra.push(mismatch);
  if (c.label) extra.push(...compareWithLabel(primary.facts, extractFacts(c.label, opts)));
  const { flags } = analyzeTurn(primary, secondary, extra);

  const found = new Set<string>();
  const missed: string[] = [];
  for (const t of c.truth) {
    const hit = primary.facts.some(f => f.type === t.type && f.value === t.value);
    if (hit) found.add(`${t.type}=${t.value}`); else missed.push(`fact ${t.type}=${t.value}`);
  }
  const extraFacts = primary.facts.filter(f => !c.truth.some(t => t.type === f.type && t.value === f.value)).length;

  const crit = flags.filter(f => f.severity === "crit");
  let plantedCaught = 0;
  for (const p of c.planted) {
    const kind = p.in === "label" ? "label_conflict" : "listener_disagreement";
    // A planted error counts as caught by a critical disagreement, or by a critical single-listener flag (a dropped negation).
    if (crit.some(f => (f.kind === kind || (kind === "listener_disagreement" && f.kind === "single_listener")) && f.type === p.type)) plantedCaught++; else missed.push(`planted ${p.type} in ${p.in}`);
  }
  const plantedTypes = new Set(c.planted.map(p => `${p.in === "label" ? "label_conflict" : "listener_disagreement"}:${p.type}`));
  const falseAlarms = crit.filter(f => (f.kind === "listener_disagreement" || f.kind === "label_conflict" || f.kind === "single_listener") && !plantedTypes.has(`${f.kind === "single_listener" ? "listener_disagreement" : f.kind}:${f.type}`)).length;

  const expected = c.expectFlags ?? [];
  let expectedCaught = 0;
  for (const k of expected) { if (flags.some(f => f.kind === k)) expectedCaught++; else missed.push(`expected flag ${k}`); }

  return { id: c.id, factsFound: found.size, factsTotal: c.truth.length, factsExtra: extraFacts, plantedCaught, plantedTotal: c.planted.length, expectedCaught, expectedTotal: expected.length, falseAlarms, flags, missed };
}

export type EvalSummary = {
  cases: number;
  factRecall: number; factPrecision: number;
  plantedCaught: number; plantedTotal: number;
  expectedCaught: number; expectedTotal: number;
  falseAlarms: number;
};

export function summarize(results: CaseResult[]): EvalSummary {
  const sum = (f: (r: CaseResult) => number) => results.reduce((n, r) => n + f(r), 0);
  const found = sum(r => r.factsFound), total = sum(r => r.factsTotal), extra = sum(r => r.factsExtra);
  return {
    cases: results.length,
    factRecall: total ? found / total : 1,
    factPrecision: found + extra ? found / (found + extra) : 1,
    plantedCaught: sum(r => r.plantedCaught), plantedTotal: sum(r => r.plantedTotal),
    expectedCaught: sum(r => r.expectedCaught), expectedTotal: sum(r => r.expectedTotal),
    falseAlarms: sum(r => r.falseAlarms),
  };
}

export function reportMarkdown(results: CaseResult[], title: string): string {
  const s = summarize(results);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const lines = [
    `# ${title}`, "",
    `| Metric | Value |`, `| --- | --- |`,
    `| Cases | ${s.cases} |`,
    `| Critical facts found (recall) | ${pct(s.factRecall)} |`,
    `| Extracted facts that were real (precision) | ${pct(s.factPrecision)} |`,
    `| Planted errors flagged | ${s.plantedCaught} of ${s.plantedTotal} |`,
    `| Other expected flags raised | ${s.expectedCaught} of ${s.expectedTotal} |`,
    `| False alarms (critical flags with no planted error) | ${s.falseAlarms} |`,
    "", `| Case | Facts | Planted | Flags | Missed |`, `| --- | --- | --- | --- | --- |`,
  ];
  for (const r of results) {
    lines.push(`| ${r.id} | ${r.factsFound}/${r.factsTotal}${r.factsExtra ? ` (+${r.factsExtra} extra)` : ""} | ${r.plantedCaught}/${r.plantedTotal} | ${r.flags.map(f => `${f.severity === "crit" ? "crit" : "warn"} ${f.kind}${f.type ? ":" + f.type : ""}`).join(", ") || "none"} | ${r.missed.join("; ") || ""} |`);
  }
  return lines.join("\n") + "\n";
}
