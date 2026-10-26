/**
 * Runs every case under eval/cases and writes a dated report to eval/runs. `npm run eval`.
 * Text cases score the deterministic core on its own; audio cases (added after the Oct 31
 * recording session) score the whole pipeline and need the services configured.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runCase, reportMarkdown, summarize, type EvalCase } from "../src/core/eval";

const root = join(import.meta.dirname, "..");
const casesDir = join(root, "eval", "cases");
const files = readdirSync(casesDir).filter(f => f.endsWith(".json")).sort();
const cases: EvalCase[] = files.flatMap(f => JSON.parse(readFileSync(join(casesDir, f), "utf8")) as EvalCase[]);
const results = cases.map(runCase);
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const md = reportMarkdown(results, `Teach-Back evaluation, ${stamp} (${files.join(", ")})`);
mkdirSync(join(root, "eval", "runs"), { recursive: true });
writeFileSync(join(root, "eval", "runs", `${stamp}.md`), md);
writeFileSync(join(root, "eval", "latest.md"), md);
const s = summarize(results);
console.log(md);
const bad = results.filter(r => r.missed.length || r.falseAlarms);
if (bad.length) { console.error(`${bad.length} case(s) with misses or false alarms.`); process.exit(1); }
console.log(`All ${s.cases} cases clean.`);
