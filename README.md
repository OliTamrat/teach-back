# Teach-Back

**A safety net for medical interpreting in Amharic and Afaan Oromo.** Two Meta models hear the
patient; code marks every fact that would hurt someone if it were wrong; a qualified interpreter
confirms each one before anything is written down.

Live: https://teach-back-phi.vercel.app · Built Oct 26 to Nov 4, 2026 for the **Meta Global AI
Developer Hackathon** (Indie Developer track, theme Build for Your World) by Oli Tamrat.

## The problem

When interpreting goes wrong in a clinic, nobody in the room can see it. The patient cannot read
the English and the clinician cannot hear the Amharic. A dropped "not", a dose off by a factor of
ten, a date read in the wrong calendar: each is invisible to everyone present. Amharic is among the
top three most-served languages at District of Columbia agencies, after Spanish, and there is no
certification exam for medical interpreters in it or in Afaan Oromo. The 2025 federal shift toward
machine translation makes the gap wider, not narrower.

## What Teach-Back does

1. The patient speaks. **Omnilingual ASR** (Meta, open weights, self-hosted) transcribes.
2. **Muse Spark** renders the transcript in English, and a second Spark call hears the same audio on
   its own and renders it again. Two listeners, one utterance.
3. **Code, not a model,** extracts the critical facts from both renderings: dose, frequency, drug,
   negation, body part and side, date, duration. Ethiopian-calendar dates are converted
   arithmetically; a date that does not exist is a flag, not a guess.
4. Where the listeners disagree on a fact, the line turns **red**. A negation heard by one listener
   only is red too, because the other may have dropped the "not".
5. A phone photo of the medication label: **SAM 3.1** finds the label, the interpreter picks the box,
   Spark reads what is printed, and a contradiction with what was spoken is a flag.
6. A **teach-back question**, from a reviewed template, for the interpreter to ask so the patient
   says the instruction back in their own words.
7. The interpreter **confirms or corrects every flag**. Only then is the English line final, and it
   joins a session log that exports as notes.

**What it is not.** Teach-Back is not a medical device, does not give medical or health advice,
does not diagnose, and never addresses a patient. No model output reaches a patient: the only
sentence meant to be spoken to them is a human-reviewed template, read by the interpreter.

## Architecture

```mermaid
flowchart LR
  P([Patient speaks]) --> R[Browser recorder]
  R -->|audio| T[/api/turn]
  T --> A[Omnilingual ASR 7B<br/>self-hosted Space]
  T --> B[Muse Spark 1.2<br/>hears the audio]
  A -->|transcript| S[Muse Spark 1.3<br/>renders English]
  S -->|English A| C
  B -->|English B + language| C
  subgraph C[Deterministic core, no model]
    F[extract facts] --> K[Ethiopian calendar] --> D[compare listeners<br/>and label] --> Q[teach-back template]
  end
  L([Label photo]) --> M[SAM 3.1 finds label] --> X[Interpreter picks box<br/>browser crops] --> V[Spark reads label] --> D
  C --> U[Interpreter screen:<br/>red flags, confirm or correct]
  U --> N[Final line, session notes]
```

Everything inside the core is pure and unit-tested (`src/core/`). The server adapters
(`src/server/`) are the only code that talks to a model, and each is tested against a fake fetch
that asserts the exact request. Screens decide nothing.

## Meta tools, and why each one

| Tool | Role | Why this one |
| --- | --- | --- |
| **Omnilingual ASR 7B** (open weights) | First listener | The one speech model with published Amharic (5.7% CER) and Afaan Oromo (7.8% CER) results. Self-hosted on an L4 as a Hugging Face Space, reused from the author's Kintale project; the adapter speaks the Space's real contract. |
| **Muse Spark 1.3** (Meta Model API) | Renders the transcript into English; reads the label crop | Reasoning model; prompts forbid adding, inferring, summarising or advising, and are unit-tested for that wording. |
| **Muse Spark 1.2** (Meta Model API) | Second listener, hears the audio directly | Audio input; reports language, transcript and English as JSON. Independent of the first listener, which is what makes a disagreement meaningful. |
| **SAM 3.1** (Meta Model API, Responses) | Finds the medication label in a phone photo | Concept segmentation from a text prompt, so the reader sees the label and not the counter top, and the interpreter picks when there are several. |
| **Muse Voice Transcribe 1.0** | Fallback first listener only | Runs when the Space is asleep (a cold start takes 15 to 25 minutes) and is named as such on the turn. Its coverage of these languages is unverified, so it is never the headline. |

## What was built during the event

All of it. The repository was created on Oct 26 and every line is new work; the day-by-day log is in
[`docs/build-log.md`](docs/build-log.md) and the reasoning behind each design decision in
[`docs/decisions.md`](docs/decisions.md). In short:

- **Core:** Ethiopian calendar, fact extraction, two-listener and label comparison, teach-back
  templates in English, Amharic and Afaan Oromo, session finalisation. 115 unit tests.
- **Audio path:** browser recorder, Omnilingual ASR adapter, Spark renderer and second listener,
  language check, Voice Transcribe fallback.
- **Label path:** SAM 3.1 finder, reviewer-chosen crop, Spark reader, label-conflict flag.
- **Reviewer flow:** confirm or correct every flag, corrections written into the final line, session
  log and export, phone layout.
- **Evaluation harness:** text cases with planted errors, audio cases scored through the live
  pipeline with character error rate, a report that can be regenerated by anyone.
- **Recording kit:** 60 scripted sentences plus 10 wrong-language items, a `/record` page, protocol
  and consent form for the Oct 31 session.
- **Hardening:** access code, per-caller and daily caps, security headers, structured logs without
  content.

## Evaluation

`npm run eval` scores the deterministic core over `eval/cases/` and writes `eval/latest.md`. The
text cases carry the facts the patient actually stated and the errors planted in one listener's
rendering; the report gives fact recall and precision, planted errors flagged, and false alarms. The
harness found seven extraction gaps and two scoring rules worth changing in its first two days, all
fixed with tests. Text cases test the code, not the models.

The audio cases run the whole pipeline through `/api/turn` when `EVAL_SERVER_URL` points at a
server with the services configured, and add each transcript's character error rate against the
sentence read. A case with no recording is reported as skipped and never counts as a miss.

### Results

Measured results over real recordings land here on Nov 1, from the Oct 31 session described in
[`docs/recording-session.md`](docs/recording-session.md). This block is written by `npm run results`
from `eval/latest.json`; no number appears here that was not produced by a run that can be repeated
from the files in `eval/`.

<!-- results:start -->
_No audio cases have run yet (70 skipped). The numbers below are the deterministic core on 15 text cases and say nothing about the models._

| Measure | Value |
| --- | --- |
| Critical facts found in the English (recall) | 100% |
| Planted errors flagged | 11 of 11 |
| False alarms | 0 |
<!-- results:end -->

## Run it

```sh
npm install
npm test            # 115 unit tests (vitest)
npm run eval        # evaluation harness; report in eval/latest.md
npm run typecheck
npm run dev         # http://localhost:3000
```

The core and the **Paste text** tab need no key. Copy `.env.example` to `.env.local` for the rest:

| Variable | What it unlocks |
| --- | --- |
| `META_MODEL_API_KEY` | Both Spark listeners, the label reader, SAM 3.1, the Voice Transcribe fallback. One key, base URL `https://api.meta.ai/v1`. |
| `ASR_SERVICE_URL`, `ASR_SERVICE_TOKEN` | Omnilingual ASR: the Space's own address and a Hugging Face read token. `GET /api/health?probe=asr` says whether its model is loaded. |
| `TEACH_BACK_ACCESS_CODE` | For a public deployment: each device is asked once before it may spend model calls. Caps per minute and per day are on regardless. |

`GET /api/health` reports what is configured without printing a secret. Environment variables
reach a Vercel deployment only after a redeploy.

## Layout

```
src/core/      pure, tested logic: calendar, facts, compare, question, session, eval, guard. No I/O.
src/server/    the only code that talks to a model or the Space: asr, meta, sam, guard.
src/app/       Next.js screens and API routes. They call the core and decide nothing themselves.
eval/          cases, the recording script, and the latest report.
docs/          build log, decisions, recording session and consent, demo script, submission text.
```

## Data and consent

No real patient data is used or stored. Test recordings are scripted sentences read by volunteers
who sign the consent form in `docs/recording-session.md`; recordings are published only with the
release box ticked, and never with a name. The session log lives in the interpreter's browser and
nowhere else. Server logs carry timings and counts, never content.

## Licence

MIT. See `LICENSE`. Meta models are used under their respective terms.
