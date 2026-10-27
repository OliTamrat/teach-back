/**
 * Turns eval/latest.json into the Results section of the README (between the markers) and the
 * sentence the submission text uses. `npm run results`. Never invents a number: with no audio run
 * it writes the honest placeholder.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resultsMarkdown, resultsSentence, type EvalSummary } from "../src/core/eval";

const root = join(import.meta.dirname, "..");
const latest = JSON.parse(readFileSync(join(root, "eval", "latest.json"), "utf8")) as { ranAt: string; summary: EvalSummary };
const block = resultsMarkdown(latest.summary, latest.ranAt);
const START = "<!-- results:start -->", END = "<!-- results:end -->";
const readmePath = join(root, "README.md");
const readme = readFileSync(readmePath, "utf8");
const a = readme.indexOf(START), b = readme.indexOf(END);
if (a < 0 || b < 0) { console.error("README.md has no results markers"); process.exit(1); }
writeFileSync(readmePath, readme.slice(0, a + START.length) + "\n" + block + "\n" + readme.slice(b));
const sentence = resultsSentence(latest.summary);
const subPath = join(root, "docs", "submission.md");
let sub = readFileSync(subPath, "utf8");
if (sentence) {
  sub = sub.replace(/\[N\] speakers, \[N\] clips, \[x\]% character error rate in Amharic and \[y\]% in\s+Afaan Oromo, \[n\] of \[m\] planted errors caught, \[k\] false alarms\./, sentence);
  writeFileSync(subPath, sub);
}
console.log(block);
console.log(sentence ? `\nSubmission sentence: ${sentence}` : "\nNo audio run yet; submission brackets left in place.");
