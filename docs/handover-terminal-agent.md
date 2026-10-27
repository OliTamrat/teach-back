# Handover: connecting Teach-Back to the real services

For a Claude Code session running on Oli's own machine, with normal network access. The cloud
session that built Days 1 to 9 cannot reach `api.meta.ai`, `huggingface.co` or `api.vercel.com`,
so everything below is still unverified against live services. This is the list of what to
collect, where it lives, what to run, and what to report back. **No secret value belongs in this
file, in a commit, in a chat log, or in Discord.** Only names and places.

## Ground rules

- Work on `main` of `OliTamrat/teach-back`. Commit as `Oli Tamrat <olitamrat@gmail.com>`, no
  attribution lines, no history rewriting. Every line in the repository must be new work from the
  event window (Oct 26 to Nov 4, 2026); never copy anything from the pre-event prototype.
- Read `docs/decisions.md` before changing behaviour. Keep tests green: `npm test`, `npm run typecheck`,
  `npm run build`.
- Teach-Back never advises a patient. Do not add wording, prompts or features that do.
- Report live outputs **verbatim**, failures included. Do not smooth anything over.

## 1. Collect, in this order

| What | Variable in Teach-Back | Where it lives | Notes |
| --- | --- | --- | --- |
| Meta Model API key | `META_MODEL_API_KEY` | dev.meta.ai → API keys. The existing key `teach-back-hackathon` cannot be re-read; create a new one (e.g. `teach-back-vercel`) and copy it once. | One key serves Spark 1.3, Spark 1.2, SAM 3.1 and Voice Transcribe. Billing page showed the $150 credit applied on Oct 27. Set a spend-limit notification. |
| Omnilingual ASR Space address | `ASR_SERVICE_URL` | `https://onekoo-kintale-asr.hf.space/`, lower case. Kintale holds the same value in `TRANSCRIBE_URL`, but that variable is stored sensitive and Vercel will not show it again — not on `env pull`, not through the API, not in the dashboard. The address is not a secret: `GET https://kintale.life/api/health` names the host in `transcriptionDetail`. | The same Space Kintale uses. It sleeps when idle and takes 15 to 25 minutes to wake. |
| Hugging Face read token | `ASR_SERVICE_TOKEN` | Mint a new one: huggingface.co → Settings → Access Tokens → Create new token, type **Read**, named for this project. Kintale's `TRANSCRIBE_TOKEN` is the same kind of token, but Hugging Face masks a value after creation and Vercel stores it sensitive, so it cannot be copied from either side; refreshing it to read it would rotate it and lock Kintale out of the Space until its own variable was updated and redeployed. | A private Space refuses without it. If the Space's own `ASR_TOKEN` secret is set (Space → Settings → Variables and secrets), that value is needed instead; a 401 from the health probe tells you which. |
| Access code for the public site | `TEACH_BACK_ACCESS_CODE` | Choose one. Avoid `$`, backticks and `!`, which shells mangle. | Judges receive it with the submission. Paste text never needs it. |

## 2. Put them in place

**Locally:** copy `.env.example` to `.env.local` in the repository root and fill the four variables.
`.env.local` is git-ignored; confirm with `git status` before any commit.

**Live site (Vercel project `teach-back`, served at `teach-back-phi.vercel.app`):** Settings →
Environment Variables → add each for Production and Preview, then **Redeploy** from the Deployments
tab. Variables reach a deployment only
through a new deployment. If using the CLI, prefer the dashboard for the values themselves: an
unquoted `$` in a shell silently eats part of a secret.

All four are set on `teach-back` for Production and Preview as of Oct 27, and the production
deployment carrying them answers `GET /api/health` with 200 and `ready: true`. `"set"` means the
variable is non-empty, not that any service accepts it: no live call below has been run yet.

## 3. Verify, in this order, and record each output

1. `GET /api/health` on the live site: expect `metaModelApi.key: "set"`, `asr.service: "set"`,
   `guard.accessCode: "set"`, `ready: true`.
2. `GET /api/health?probe=asr`: `asr.probe.reachable` and `asr.probe.ready`. If `ready` is false the
   Space is waking; the GET itself wakes it. Wait and repeat. A 401 means the token is wrong or the
   Space's own `ASR_TOKEN` is set (table above). A 404 means the URL is the huggingface.co page, not
   the `hf.space` address.
3. **First live turn.** Open the live site, enter the access code when asked, choose Amharic, Record a
   turn, read S01 from `eval/recording-script.json` aloud, Stop. Capture the whole response from the
   network tab (or `curl -F audio=@clip.webm -F language=am -F reference=<today> -H "x-access: <code>" <site>/api/turn`).
   Record verbatim: `firstListener`, `notes`, both transcripts, both English renderings, `detected`,
   `timings`, `flags`.
4. **Three request shapes are confirmed only by this first call.** If one fails, the note on the turn
   names it. Fix in the file given, keep the test next to it green, and record the real shape in
   `docs/decisions.md`:
   - Spark 1.2 audio input (`src/server/meta.ts`, `listen()`): `input_audio` with base64 and format.
   - Spark 1.3 image input (`src/server/meta.ts`, `readLabel()`): `image_url` with a data URL.
   - SAM 3.1 Responses call (`src/server/sam.ts`, `findLabels()` and `extractBoxes()`): request body
     and the shape boxes come back in. `extractBoxes` is tolerant; log the raw response once and
     tighten it to the real shape.
   - Voice Transcribe (`src/server/meta.ts`, `voiceTranscribe()`): multipart `file`, `model`,
     `language` to `/v1/asr/transcribe`. Only exercised when the Space is down; test it once by
     setting `ASR_SERVICE_URL` empty locally.
5. **Label path.** Photograph any medication box with personal details covered, Find label, pick a
   box, Read this label, Re-check. Record the raw SAM response (from the server log or a temporary
   `console.log`) and what Spark read.
6. **Language test.** The pre-event spike harness (not in this repository) can run against the key to
   measure Spark on Amharic and Afaan Oromo text and audio: `node spike.mjs --list-models`, then the
   blocks. Keep its results outside the repository or under `eval/runs/`, which is git-ignored.
7. **Recording session, Oct 31.** Volunteers use `/record`; reviewers use `/review`. Collect clips into
   `eval/audio/` (git-ignored unless released) and review files. Apply reviews with
   `npm run review:apply -- <file>`. Then, with the local server up and configured:
   `EVAL_SERVER_URL=http://localhost:3000 EVAL_SPEAKERS=<n> npm run eval && npm run results`.
   Commit `eval/latest.md`, `eval/latest.json`, the README Results block and `docs/submission.md`
   together. Every number in the README must come from that run.

## 4. Report back

For each step above: the command or action, the status code, and the body or screen, verbatim.
Then the three things a judge will ask: did Omnilingual transcribe Amharic and Afaan Oromo, did the
two listeners ever disagree on a clean reading (false alarms), and did the dropped "not" turn red.

## 5. Do not

- Paste a key, token or URL-with-token anywhere that persists.
- Commit `.env.local`, clips without release consent, or reviewer names outside the data files.
- Change the human gate: no automatic confirmation, no model deciding a flag, no sentence from a
  model shown as something to say to a patient.
- Skip a failing test to get green, or rewrite history on `main`.
