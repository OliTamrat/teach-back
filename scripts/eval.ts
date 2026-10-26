/**
 * Runs every case under eval/cases and writes a dated report to eval/runs. `npm run eval`.
 * Text cases score the deterministic core on its own; audio cases (added after the Oct 31
 * recording session) score the whole pipeline and need the services configured.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { cer, runCase, scoreTurn, reportMarkdown, summarize, type CaseResult, type EvalCase } from "../src/core/eval";
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
  const skip = (why: string): CaseResult => ({ id: c.id, factsFound: 0, factsTotal: c.truth.length, factsExtra: 0, plantedCaught: 0, plantedTotal: c.planted.length, expectedCaught: 0, expectedTotal: (c.expectFlags ?? []).length, falseAlarms: 0, flags: [], missed: [], skipped: why });
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

async function main() {
const results: CaseResult[] = [];
for (const c of cases) results.push(c.audio ? await runAudio(c) : runCase(c));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const md = reportMarkdown(results, `Teach-Back evaluation, ${stamp} (${files.join(", ")})`);
mkdirSync(join(root, "eval", "runs"), { recursive: true });
writeFileSync(join(root, "eval", "runs", `${stamp}.md`), md);
writeFileSync(join(root, "eval", "latest.md"), md);
const s = summarize(results);
console.log(md);
const bad = results.filter(r => !r.skipped && (r.missed.length || r.falseAlarms));
if (bad.length) { console.error(`${bad.length} case(s) with misses or false alarms.`); process.exit(1); }
console.log(`All ${s.cases} scored cases clean${s.skipped ? `, ${s.skipped} skipped` : ""}.`);
}

void main();
