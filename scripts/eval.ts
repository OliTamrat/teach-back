/**
 * Runs every case under eval/cases and writes a dated report to eval/runs. `npm run eval`.
 * Text cases score the deterministic core on its own; audio cases (added after the Oct 31
 * recording session) score the whole pipeline and need the services configured.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { cer, runCase, scoreTurn, reportMarkdown, summarize, type CaseResult, type EvalCase } from "../src/core/eval";
import { scoreVisit, textResults, visitsMarkdown, type LineResult, type Visit, type VisitScore } from "../src/core/visits";
import type { Fact, Flag } from "../src/core/types";

const root = join(import.meta.dirname, "..");
const casesDir = join(root, "eval", "cases");
const files = readdirSync(casesDir).filter(f => f.endsWith(".json")).sort();
const cases: EvalCase[] = files.flatMap(f => JSON.parse(readFileSync(join(casesDir, f), "utf8")) as EvalCase[]);
/**
 * Audio cases go through a running server (EVAL_SERVER_URL, e.g. http://localhost:3000), which must
 * have the services configured. Without a server or a recording the case is reported as skipped,
 * never scored as a miss.
 */
const server = (process.env.EVAL_SERVER_URL || "").replace(/\/$/, "");
async function runAudio(c: EvalCase): Promise<CaseResult> {
  const skip = (why: string): CaseResult => ({ id: c.id, language: c.language, audio: true, factsFound: 0, factsTotal: c.truth.length, factsExtra: 0, plantedCaught: 0, plantedTotal: c.planted.length, expectedCaught: 0, expectedTotal: (c.expectFlags ?? []).length, falseAlarms: 0, flags: [], missed: [], skipped: why });
  if (!server) return skip("set EVAL_SERVER_URL to run audio cases");
  const file = join(root, c.audio!);
  if (!existsSync(file)) return skip(`no recording at ${c.audio}`);
  const form = new FormData();
  const ext = file.split(".").pop() || "webm";
  form.append("audio", new Blob([readFileSync(file)], { type: `audio/${ext === "m4a" ? "mp4" : ext}` }), `${c.id}.${ext}`);
  form.append("language", c.language);
  form.append("reference", c.reference);
  const res = await fetch(`${server}/api/turn`, { method: "POST", body: form });
  const json = await res.json() as { primary?: { facts: Fact[] }; flags?: Flag[]; transcript?: string; notes?: string[]; error?: string };
  if (!res.ok || !json.primary) return skip(`server ${res.status}: ${json.error || ""} ${(json.notes || []).join("; ")}`.trim());
  const r = scoreTurn(c, json.primary.facts, json.flags || []);
  if (c.text && json.transcript) r.cer = cer(c.text, json.transcript);
  return r;
}

/**
 * Visits: every line of a scripted two-way exchange through the pipeline in order, placed with the
 * alternation rule, and the planted take's interpreter errors scored. Text mode scores the core on
 * the script's own English; audio mode needs the server and a clip per line (eval/audio/<id>.wav).
 */
const visits = (JSON.parse(readFileSync(join(root, "eval", "visits.json"), "utf8")) as { visits: Visit[] }).visits;
async function runVisitAudio(v: Visit, take: "faithful" | "planted"): Promise<VisitScore> {
  const skip = (why: string): VisitScore => ({ id: v.id, take, rolesRight: 0, rolesTotal: v.turns.length, plantedCaught: 0, plantedTotal: 0, falseAlarms: 0, flags: [], missed: [], skipped: why });
  if (!server) return skip("set EVAL_SERVER_URL to run audio visits");
  const results: LineResult[] = [];
  for (let i = 0; i < v.turns.length; i++) {
    const t = v.turns[i];
    const id = i === v.turns.length - 1 && take === "planted" && t.planted ? t.planted.id : t.id;
    const file = join(root, "eval", "audio", `${id}.wav`);
    if (!existsSync(file)) return skip(`no recording at eval/audio/${id}.wav`);
    const form = new FormData();
    form.append("audio", new Blob([readFileSync(file)], { type: "audio/wav" }), `${id}.wav`);
    form.append("language", "auto"); form.append("session", v.session); form.append("reference", "2026-10-31");
    const res = await fetch(`${server}/api/turn`, { method: "POST", body: form });
    const json = await res.json() as { language?: LineResult["language"]; primary?: { english: string }; flags?: Flag[]; transcript?: string; error?: string; notes?: string[] };
    if (!res.ok || !json.primary || !json.language) return skip(`server ${res.status} on ${id}: ${json.error || ""} ${(json.notes || []).join("; ")}`.trim());
    results.push({ language: json.language, english: json.primary.english, listenerFlags: json.flags || [], transcript: json.transcript });
  }
  return scoreVisit(v, take, results);
}

async function main() {
const results: CaseResult[] = [];
for (const c of cases) results.push(c.audio ? await runAudio(c) : runCase(c));
const visitScores: VisitScore[] = [];
for (const v of visits) for (const take of ["faithful", "planted"] as const) {
  visitScores.push(scoreVisit(v, take, textResults(v, take)));
  visitScores.push(server ? await runVisitAudio(v, take) : { id: v.id, take, rolesRight: 0, rolesTotal: v.turns.length, plantedCaught: 0, plantedTotal: 0, falseAlarms: 0, flags: [], missed: [], skipped: "set EVAL_SERVER_URL to run audio visits" });
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const md = reportMarkdown(results, `Teach-Back evaluation, ${stamp} (${files.join(", ")})`) + visitsMarkdown(visitScores).join("\n") + "\n";
mkdirSync(join(root, "eval", "runs"), { recursive: true });
writeFileSync(join(root, "eval", "runs", `${stamp}.md`), md);
writeFileSync(join(root, "eval", "latest.md"), md);
const s = summarize(results);
if (process.env.EVAL_SPEAKERS) s.speakers = Number(process.env.EVAL_SPEAKERS) || undefined;
const vr = visitScores.filter(x => !x.skipped);
s.visits = { takes: vr.length, rolesRight: vr.reduce((n, x) => n + x.rolesRight, 0), rolesTotal: vr.reduce((n, x) => n + x.rolesTotal, 0), plantedCaught: vr.reduce((n, x) => n + x.plantedCaught, 0), plantedTotal: vr.reduce((n, x) => n + x.plantedTotal, 0), falseAlarms: vr.reduce((n, x) => n + x.falseAlarms, 0), audioTakes: visitScores.filter(x => !x.skipped).length - visits.length * 2 };
writeFileSync(join(root, "eval", "latest.json"), JSON.stringify({ ranAt: new Date().toISOString(), files, summary: s, visits: visitScores.map(x => ({ id: x.id, take: x.take, rolesRight: x.rolesRight, rolesTotal: x.rolesTotal, plantedCaught: x.plantedCaught, plantedTotal: x.plantedTotal, falseAlarms: x.falseAlarms, skipped: x.skipped ?? null })), cases: results.map(r => ({ id: r.id, language: r.language, audio: r.audio, factsFound: r.factsFound, factsTotal: r.factsTotal, cer: r.cer ?? null, flags: r.flags.map(f => `${f.severity} ${f.kind}${f.type ? ":" + f.type : ""}`), missed: r.missed, skipped: r.skipped ?? null })) }, null, 1) + "\n");
console.log(md);
const badVisits = visitScores.filter(x => !x.skipped && (x.missed.length || x.falseAlarms));
const bad = [...results.filter(r => !r.skipped && (r.missed.length || r.falseAlarms)), ...badVisits];
if (bad.length) { console.error(`${bad.length} case(s) with misses or false alarms.`); process.exit(1); }
console.log(`All ${s.cases} scored cases clean${s.skipped ? `, ${s.skipped} skipped` : ""}.`);
}

void main();
