/**
 * Writes a native speaker's review back into the recording script and the question templates.
 *   npm run review:apply -- path/to/review-am.json
 * Refuses to write anything when the review has problems, and prints them.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyReview, type ReviewFile, type Script, type Templates } from "../src/core/review";

const root = join(import.meta.dirname, "..");
const file = process.argv[2];
if (!file) { console.error("usage: npm run review:apply -- <review.json>"); process.exit(2); }
const review = JSON.parse(readFileSync(file, "utf8")) as ReviewFile;
const scriptPath = join(root, "eval", "recording-script.json");
const templatesPath = join(root, "src", "core", "question-templates.json");
const script = JSON.parse(readFileSync(scriptPath, "utf8")) as Script;
const templates = JSON.parse(readFileSync(templatesPath, "utf8")) as Templates;
const r = applyReview(script, templates, review);
if (r.problems.length) { console.error("Not applied. Problems:\n- " + r.problems.join("\n- ")); process.exit(1); }
writeFileSync(scriptPath, JSON.stringify(r.script, null, 1) + "\n");
writeFileSync(templatesPath, JSON.stringify(r.templates, null, 2) + "\n");
console.log(`Applied ${r.applied.sentences} sentence review(s) and ${r.applied.templates} template review(s) for ${review.language} by ${review.reviewer}.${r.applied.languageReviewed ? ` ${review.language} question templates are now reviewed.` : ""}`);
