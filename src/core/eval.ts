/**
 * Scoring for the evaluation harness. A case is a turn with known truth: the critical facts the
 * patient actually stated, and the errors deliberately planted in one listener's rendering. The
 * system is scored on two questions judges care about: did it find the facts, and did it flag
 * the planted errors without crying wolf. Pure, so the same scorer runs over text cases today and
 * over real recordings once they exist.
 */
import { extractFacts } from "./facts";
import { analyzeTurn, compareListeners, compareWithLabel, compareWithSource, languageMismatch } from "./compare";
import type { Fact, FactType, Flag, Language } from "./types";

export type EvalCase = {
  id: string;
  language: Language;
  /** Path to a recording, relative to the repository root. Present on audio cases, which run through /api/turn. */
  audio?: string;
  /** What was read aloud, for a character error rate against the transcript. */
  text?: string;
  /** ISO date the words were spoken; Ethiopian dates resolve against it. */
  reference: string;
  /** What the patient said, for the record. Not scored. */
  said?: string;
  /** Provider turn: what the provider said in English. `a` is then the interpreter's rendering heard back in English. */
  source?: string;
  /** Listener A's English rendering. Required for text cases; on audio cases the pipeline produces it. */
  a?: string;
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
  language: Language;
  audio: boolean;
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
  /** Audio cases only: character error rate of the first listener's transcript against the text read. */
  cer?: number;
  skipped?: string;
};

/** A text case: both renderings are given, the core does the rest. */
export function runCase(c: EvalCase): CaseResult {
  const [y, m, d] = c.reference.split("-").map(Number);
  const opts = { reference: { year: y, month: m, day: d }, language: c.language };
  const a = c.a ?? "";
  if (c.source) {
    // A provider turn: the truth is what the provider said; the rendering is checked against it.
    const source = extractFacts(c.source, opts);
    const rendered = { name: "A", english: a, facts: extractFacts(a, opts) };
    const second = c.b ? { name: "B", english: c.b, facts: extractFacts(c.b, opts) } : undefined;
    const flags = [...compareWithSource(source, rendered.facts), ...compareListeners(rendered, second)];
    return scoreTurn(c, source, flags);
  }
  const primary = { name: "A", english: a, facts: extractFacts(a, opts) };
  const secondary = c.b ? { name: "B", english: c.b, facts: extractFacts(c.b, opts) } : undefined;
  const extra: Flag[] = [];
  const mismatch = languageMismatch(c.language, c.spoken ?? null);
  if (mismatch) extra.push(mismatch);
  if (c.label) extra.push(...compareWithLabel(primary.facts, extractFacts(c.label, opts)));
  const { flags } = analyzeTurn(primary, secondary, extra);
  return scoreTurn(c, primary.facts, flags);
}

/** Score what a turn produced, whichever path produced it: the core alone or the whole pipeline. */
export function scoreTurn(c: EvalCase, primaryFacts: Fact[], flags: Flag[]): CaseResult {
  const primary = { facts: primaryFacts };
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
    // A planted error counts as caught by a critical disagreement, a critical single-listener flag (a dropped
    // negation), or on a provider turn by the interpreter check (changed or dropped).
    const interp = c.source && (p.in === "a" || p.in === "b");
    if (crit.some(f => f.type === p.type && (f.kind === kind || (kind === "listener_disagreement" && f.kind === "single_listener") || (interp && (f.kind === "interpreter_changed" || f.kind === "interpreter_dropped"))))) plantedCaught++; else missed.push(`planted ${p.type} in ${p.in}`);
  }
  const plantedTypes = new Set(c.planted.map(p => `${p.in === "label" ? "label_conflict" : "listener_disagreement"}:${p.type}`));
  const asPlanted = (k: Flag["kind"]) => k === "single_listener" || k === "interpreter_changed" || k === "interpreter_dropped" ? "listener_disagreement" : k;
  const falseAlarms = crit.filter(f => ["listener_disagreement", "label_conflict", "single_listener", "interpreter_changed", "interpreter_dropped"].includes(f.kind) && !plantedTypes.has(`${asPlanted(f.kind)}:${f.type}`)).length;

  const expected = c.expectFlags ?? [];
  let expectedCaught = 0;
  for (const k of expected) { if (flags.some(f => f.kind === k)) expectedCaught++; else missed.push(`expected flag ${k}`); }

  return { id: c.id, language: c.language, audio: Boolean(c.audio), factsFound: found.size, factsTotal: c.truth.length, factsExtra: extraFacts, plantedCaught, plantedTotal: c.planted.length, expectedCaught, expectedTotal: expected.length, falseAlarms, flags, missed };
}

export type LanguageSummary = { language: Language; cases: number; factRecall: number; meanCer: number | null; expectedCaught: number; expectedTotal: number };
export type EvalSummary = {
  cases: number;
  byLanguage: LanguageSummary[];
  speakers?: number;
  factRecall: number; factPrecision: number;
  plantedCaught: number; plantedTotal: number;
  expectedCaught: number; expectedTotal: number;
  falseAlarms: number;
  skipped: number;
  /** Mean character error rate over audio cases that ran, or null when none did. */
  meanCer: number | null;
};

export function summarize(all: CaseResult[]): EvalSummary {
  const skipped = all.filter(r => r.skipped).length;
  const results = all.filter(r => !r.skipped);
  const withCer = results.filter(r => typeof r.cer === "number");
  const sum = (f: (r: CaseResult) => number) => results.reduce((n, r) => n + f(r), 0);
  const found = sum(r => r.factsFound), total = sum(r => r.factsTotal), extra = sum(r => r.factsExtra);
  // Once audio has run, the per-language figures describe recorded clips only; text cases never pose as clips.
  const audioRan = results.some(r => r.audio);
  const byLanguage: LanguageSummary[] = (["am", "om"] as Language[]).map(language => {
    const rs = results.filter(r => r.language === language && (!audioRan || r.audio));
    const f = rs.reduce((n, r) => n + r.factsFound, 0), t = rs.reduce((n, r) => n + r.factsTotal, 0);
    const c = rs.filter(r => typeof r.cer === "number");
    return { language, cases: rs.length, factRecall: t ? f / t : 1, meanCer: c.length ? c.reduce((n, r) => n + (r.cer as number), 0) / c.length : null, expectedCaught: rs.reduce((n, r) => n + r.expectedCaught, 0), expectedTotal: rs.reduce((n, r) => n + r.expectedTotal, 0) };
  }).filter(l => l.cases > 0);
  return {
    cases: results.length,
    byLanguage,
    factRecall: total ? found / total : 1,
    factPrecision: found + extra ? found / (found + extra) : 1,
    plantedCaught: sum(r => r.plantedCaught), plantedTotal: sum(r => r.plantedTotal),
    expectedCaught: sum(r => r.expectedCaught), expectedTotal: sum(r => r.expectedTotal),
    falseAlarms: sum(r => r.falseAlarms),
    skipped,
    meanCer: withCer.length ? withCer.reduce((n, r) => n + (r.cer as number), 0) / withCer.length : null,
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
    ...(s.meanCer !== null ? [`| Mean transcript character error rate (audio cases) | ${pct(s.meanCer)} |`] : []),
    ...(s.skipped ? [`| Skipped (audio not run) | ${s.skipped} |`] : []),
    ...s.byLanguage.filter(l => l.meanCer !== null).map(l => `| ${l.language === "am" ? "Amharic" : "Afaan Oromo"}: transcript character error rate | ${pct(l.meanCer as number)} over ${l.cases} clip${l.cases === 1 ? "" : "s"} |`),
    "", `| Case | Facts | Planted | CER | Flags | Missed |`, `| --- | --- | --- | --- | --- | --- |`,
  ];
  for (const r of results) {
    if (r.skipped) { lines.push(`| ${r.id} | skipped | | | | ${r.skipped} |`); continue; }
    lines.push(`| ${r.id} | ${r.factsFound}/${r.factsTotal}${r.factsExtra ? ` (+${r.factsExtra} extra)` : ""} | ${r.plantedCaught}/${r.plantedTotal} | ${typeof r.cer === "number" ? pct(r.cer) : ""} | ${r.flags.map(f => `${f.severity === "crit" ? "crit" : "warn"} ${f.kind}${f.type ? ":" + f.type : ""}`).join(", ") || "none"} | ${r.missed.join("; ") || ""} |`);
  }
  return lines.join("\n") + "\n";
}

/** Character error rate: Levenshtein distance over the reference length, whitespace collapsed, punctuation kept. */
export function cer(reference: string, hypothesis: string): number {
  const r = [...reference.replace(/\s+/g, " ").trim()], h = [...hypothesis.replace(/\s+/g, " ").trim()];
  if (!r.length) return h.length ? 1 : 0;
  let prev = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) {
    const cur = [i];
    for (let j = 1; j <= h.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[h.length] / r.length;
}

/**
 * The results paragraph and table for the README and the submission text, from a summary. Written
 * only when audio cases have run; until then the text says so, so a reader never mistakes the text
 * cases for a measurement of the models.
 */
export function resultsMarkdown(s: EvalSummary, ranAt: string): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const audio = s.byLanguage.filter(l => l.meanCer !== null);
  if (!audio.length) {
    return [
      `_No audio cases have run yet (${s.skipped} skipped). The numbers below are the deterministic core on ${s.cases} text cases and say nothing about the models._`, "",
      `| Measure | Value |`, `| --- | --- |`,
      `| Critical facts found in the English (recall) | ${pct(s.factRecall)} |`,
      `| Planted errors flagged | ${s.plantedCaught} of ${s.plantedTotal} |`,
      `| False alarms | ${s.falseAlarms} |`,
    ].join("\n");
  }
  const am = audio.find(l => l.language === "am"), om = audio.find(l => l.language === "om");
  const clips = audio.reduce((n, l) => n + l.cases, 0);
  const lines = [
    `Measured ${ranAt.slice(0, 10)} over ${clips} recorded clip${clips === 1 ? "" : "s"}${s.speakers ? ` from ${s.speakers} speaker${s.speakers === 1 ? "" : "s"}` : ""}, scripted sentences read by consenting volunteers. Regenerate with \`EVAL_SERVER_URL=<server> npm run eval && npm run results\`.`, "",
    `| Measure | Amharic | Afaan Oromo |`, `| --- | --- | --- |`,
    `| Clips | ${am?.cases ?? 0} | ${om?.cases ?? 0} |`,
    `| Transcript character error rate (Omnilingual ASR) | ${am ? pct(am.meanCer as number) : "n/a"} | ${om ? pct(om.meanCer as number) : "n/a"} |`,
    `| Critical facts that survived to the English | ${am ? pct(am.factRecall) : "n/a"} | ${om ? pct(om.factRecall) : "n/a"} |`,
    `| Wrong-language items caught | ${am ? `${am.expectedCaught} of ${am.expectedTotal}` : "n/a"} | ${om ? `${om.expectedCaught} of ${om.expectedTotal}` : "n/a"} |`, "",
    `Across all cases: ${s.plantedCaught} of ${s.plantedTotal} planted errors flagged, ${s.falseAlarms} false alarm${s.falseAlarms === 1 ? "" : "s"}.`,
  ];
  return lines.join("\n");
}

/** The sentence the submission text and the video narration use. */
export function resultsSentence(s: EvalSummary): string | null {
  const am = s.byLanguage.find(l => l.language === "am" && l.meanCer !== null), om = s.byLanguage.find(l => l.language === "om" && l.meanCer !== null);
  if (!am && !om) return null;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const clips = (am?.cases ?? 0) + (om?.cases ?? 0);
  return `${s.speakers ? `${s.speakers} speakers, ` : ""}${clips} clips, character error rate of ${am ? pct(am.meanCer as number) : "n/a"} in Amharic and ${om ? pct(om.meanCer as number) : "n/a"} in Afaan Oromo; ${s.plantedCaught} of ${s.plantedTotal} planted errors caught, ${s.falseAlarms} false alarm${s.falseAlarms === 1 ? "" : "s"}.`;
}
