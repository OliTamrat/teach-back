/**
 * Live shape check against a running deployment.
 *
 * Unit tests pin the request shapes this repository believes in; only a live call says whether the
 * APIs agree. Every shape correction on record (decisions 18, 23) came from running this against
 * the real thing and reading the refusal, so it is kept rather than retyped each time.
 *
 *   TEACH_BACK_SITE=https://teach-back-phi.vercel.app \
 *   TEACH_BACK_ACCESS_CODE=... \
 *   npm run smoke -- --audio clip.wav --language am --image label.png
 *
 * The access code is read from the environment and never from an argument, so it stays out of a
 * shell history. Nothing here writes a key, a code or a transcript to disk.
 */
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";

const site = (process.env.TEACH_BACK_SITE || "http://localhost:3000").replace(/\/$/, "");
const code = process.env.TEACH_BACK_ACCESS_CODE || "";
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : ""; };

const audio = arg("audio");
const image = arg("image");
const language = arg("language") || "am";
const reference = arg("reference") || new Date().toISOString().slice(0, 10);

const MIME: Record<string, string> = {
  ".wav": "audio/wav", ".webm": "audio/webm", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
};
function part(path: string) {
  const type = MIME[extname(path).toLowerCase()] || "application/octet-stream";
  return new File([new Uint8Array(readFileSync(path))], basename(path), { type });
}
const headers = code ? { "x-access": code } : undefined;

async function post(route: string, form: FormData) {
  const t0 = Date.now();
  const res = await fetch(`${site}${route}`, { method: "POST", headers, body: form });
  const body = await res.text();
  console.log(`\n${route}  ${res.status}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  try { console.log(JSON.stringify(JSON.parse(body), null, 2)); } catch { console.log(body.slice(0, 1200)); }
  return res.status;
}

async function main() {
  const health = await fetch(`${site}/api/health?probe=asr`);
  console.log(`\n/api/health?probe=asr  ${health.status}`);
  console.log(JSON.stringify(await health.json(), null, 2));
  if (!audio && !image) {
    console.log("\nNothing else to send. Pass --audio <file> and/or --image <file>.");
    console.log("A WAV reaches Muse Voice Transcribe; a WebM does not (decision 23).");
    return;
  }
  if (audio) {
    const f = new FormData();
    f.append("audio", part(audio)); f.append("language", language); f.append("reference", reference);
    await post("/api/turn", f);
  }
  if (image) {
    const find = new FormData(); find.append("photo", part(image));
    await post("/api/label/find", find);
    const read = new FormData(); read.append("image", part(image));
    await post("/api/label/read", read);
  }
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
