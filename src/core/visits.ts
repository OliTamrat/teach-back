/**
 * Scoring a scripted visit: the measurement behind the claim that the interpreter is checked in
 * both directions. A visit is a short two-way exchange with known English for every line and a
 * planted variant of the interpreter's last line. Each line's rendering (given directly for a text
 * run, produced by the pipeline for an audio run) is placed with the alternation rule and the
 * interpreter flags are scored: did the planted errors come out as critical interpreter flags on
 * the planted take, and did the faithful take raise none.
 */
import { placeTurn, type ConversationTurn } from "./conversation";
import { extractFacts } from "./facts";
import type { FactType, Flag, Language, SpeechLanguage } from "./types";

export type VisitTurn = { id: string; speaker: "patient" | "interpreter" | "provider"; language: SpeechLanguage; english: string; text?: string; planted?: { id: string; english: string; text?: string; errors: Array<{ type: FactType }> } };
export type Visit = { id: string; session: Language; title: string; turns: VisitTurn[] };

/** What a run produced for one line: the English rendering and the listeners' own flags. */
export type LineResult = { language: SpeechLanguage; english: string; listenerFlags: Flag[]; transcript?: string };

export type VisitScore = {
  id: string; take: "faithful" | "planted";
  /** text: the script's own English through the core; audio: clips through the live pipeline. */
  mode: "text" | "audio";
  rolesRight: number; rolesTotal: number;
  plantedCaught: number; plantedTotal: number;
  falseAlarms: number;
  flags: Flag[];
  missed: string[];
  skipped?: string;
};

const EXPECTED_ROLE = (speaker: VisitTurn["speaker"], language: SpeechLanguage): ConversationTurn["role"] =>
  speaker === "patient" ? "patient" : speaker === "provider" ? "provider" : language === "en" ? "interpreter_to_provider" : "interpreter_to_patient";

/** Score one take of a visit from its line results, in order. */
export function scoreVisit(visit: Visit, take: "faithful" | "planted", results: LineResult[], mode: "text" | "audio" = "text", reference = { year: 2026, month: 10, day: 31 }): VisitScore {
  const placed: ConversationTurn[] = [];
  let rolesRight = 0;
  visit.turns.forEach((t, i) => {
    const r = results[i];
    const facts = extractFacts(r.english, { reference, language: visit.session });
    const turn = placeTurn(placed, { id: t.id, at: "", language: r.language, english: r.english, transcript: r.transcript ?? "", facts, listenerFlags: r.listenerFlags }, visit.session);
    placed.push(turn);
    if (turn.role === EXPECTED_ROLE(t.speaker, t.language)) rolesRight++;
  });
  const last = placed[placed.length - 1];
  const interp = placed.flatMap(t => t.interpreterFlags);
  const crit = interp.filter(f => f.severity === "crit");
  const plantedErrors = take === "planted" ? (visit.turns[visit.turns.length - 1].planted?.errors ?? []) : [];
  const missed: string[] = [];
  let plantedCaught = 0;
  for (const e of plantedErrors) {
    if (last.interpreterFlags.some(f => f.severity === "crit" && f.type === e.type)) plantedCaught++; else missed.push(`planted ${e.type} not flagged`);
  }
  const plantedTypes = new Set(plantedErrors.map(e => e.type));
  const falseAlarms = crit.filter(f => !plantedTypes.has(f.type as FactType) || placed.indexOf(placed.find(p => p.interpreterFlags.includes(f))!) !== placed.length - 1).length;
  return { id: visit.id, take, mode, rolesRight, rolesTotal: visit.turns.length, plantedCaught, plantedTotal: plantedErrors.length, falseAlarms, flags: interp, missed };
}

/** A text run: every line's rendering is its own English, the planted take swapping in the planted line. */
export function textResults(visit: Visit, take: "faithful" | "planted"): LineResult[] {
  return visit.turns.map((t, i) => {
    const last = i === visit.turns.length - 1 && take === "planted" && t.planted;
    return { language: t.language, english: last ? t.planted!.english : t.english, listenerFlags: [] };
  });
}

export type VisitAggregate = { takes: number; rolesRight: number; rolesTotal: number; plantedCaught: number; plantedTotal: number; falseAlarms: number };
export function aggregateVisits(scores: VisitScore[], mode: "text" | "audio"): VisitAggregate {
  const ran = scores.filter(s => !s.skipped && s.mode === mode);
  const sum = (f: (s: VisitScore) => number) => ran.reduce((n, s) => n + f(s), 0);
  return { takes: ran.length, rolesRight: sum(s => s.rolesRight), rolesTotal: sum(s => s.rolesTotal), plantedCaught: sum(s => s.plantedCaught), plantedTotal: sum(s => s.plantedTotal), falseAlarms: sum(s => s.falseAlarms) };
}
export function visitsMarkdown(scores: VisitScore[]): string[] {
  if (!scores.some(s => !s.skipped)) return [];
  const row = (label: string, a: VisitAggregate) => a.takes ? [`| ${label}: takes | ${a.takes} |`, `| ${label}: roles from the alternation rule that matched the script | ${a.rolesRight} of ${a.rolesTotal} |`, `| ${label}: planted interpreter errors flagged | ${a.plantedCaught} of ${a.plantedTotal} |`, `| ${label}: false alarms on faithful lines | ${a.falseAlarms} |`] : [`| ${label} | not run |`];
  const lines = [
    "", `## Visits: the interpreter checked both ways`, "",
    `| Measure | Value |`, `| --- | --- |`,
    ...row("Text (the core on the script's English)", aggregateVisits(scores, "text")),
    ...row("Audio (clips through the live pipeline)", aggregateVisits(scores, "audio")),
    "", `| Visit | Take | Mode | Roles | Planted | False alarms | Flags | Missed |`, `| --- | --- | --- | --- | --- | --- | --- | --- |`,
  ];
  for (const s of scores) {
    if (s.skipped) { lines.push(`| ${s.id} | ${s.take} | ${s.mode} | skipped | | | | ${s.skipped} |`); continue; }
    lines.push(`| ${s.id} | ${s.take} | ${s.mode} | ${s.rolesRight}/${s.rolesTotal} | ${s.plantedCaught}/${s.plantedTotal} | ${s.falseAlarms} | ${s.flags.map(f => `${f.severity} ${f.kind}${f.type ? ":" + f.type : ""}`).join(", ") || "none"} | ${s.missed.join("; ")} |`);
  }
  return lines;
}
