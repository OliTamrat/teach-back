# Teach-Back

[![CI](https://github.com/OliTamrat/teach-back/actions/workflows/ci.yml/badge.svg)](https://github.com/OliTamrat/teach-back/actions/workflows/ci.yml)

**A safety net for interpreting in Amharic and Afaan Oromo, built by someone who has sat on both
sides of the table.**

Live: https://teach-back-phi.vercel.app · Built Oct 26 to Nov 4, 2026 for the **Meta Global AI
Developer Hackathon** (Indie Developer track, theme Build for Your World) by Oli Tamrat.

## Why I built this

I am Ethiopian. I grew up speaking Afaan Oromo and Amharic, and I live in the Washington DC area,
home to one of the largest Ethiopian communities outside Ethiopia. Since I was young I have been the
person in the family, and often in the neighbourhood, who goes along to the clinic, the immigration
office, the school, the benefits office, and interprets. I have watched a nurse explain a dose to my
relative through a phone interpreter who did not know the word for the medicine. I have watched an
asylum officer ask a date and receive a date from the Ethiopian calendar, written down as if it were
the Gregorian one, seven or eight years off. I have watched an elder say "I am not allergic" and
heard it come back as "allergic", and nobody in the room but me could tell.

What makes these errors dangerous is that they are invisible to everyone present. The patient cannot
read the English. The clinician cannot hear the Amharic. The interpreter, if there is one, is
working alone, fast, with nobody checking. The agencies are not careless: Amharic is among the top
three most-served languages at District of Columbia agencies, after Spanish, and the courts here
created the country's first Amharic court-interpreter exam because they could not find enough
certified people. But there is still no oral certification exam for medical interpreters in either
of my languages, and in 2025 federal policy moved toward machine translation while leaving providers
responsible for its mistakes. The machine is coming into the room whether the community is ready or
not.

This is not a Washington problem. Millions of Ethiopians live outside Ethiopia: in the United
States and Canada, across Europe, in the Gulf, in Israel, in Kenya, South Africa and Australia. In
every one of those places a mother is explaining a child's fever to a doctor who does not speak her
language, and an officer is writing down a date from a calendar he has never heard of. The
interpreters who serve them, professional or family, deserve a second pair of ears.

So I built one. Teach-Back is the tool I wished I had on those afternoons: it listens alongside the
interpreter, marks every fact that would hurt someone if it were wrong, and makes a human confirm
each one before anything is written down. I know these languages, I know these rooms, and I know
what the machine gets wrong in them, because I have been correcting it by hand for years.

## What it does

1. The patient speaks. **Omnilingual ASR**, Meta's open-weights speech model with published results
   for both of my languages, transcribes it. I run it myself on a GPU.
2. **Muse Spark** renders the transcript in English, and a second Spark call hears the same seconds
   of audio on its own and renders it again. Two listeners, one utterance.
3. **Code, not a model,** pulls the critical facts out of both renderings: dose, frequency, drug,
   negation, body part and side, date, duration. Ethiopian-calendar dates are converted
   arithmetically, the way I do it in my head. A date that does not exist, like Pagume 6 in a year
   that is not a leap year, is a flag, not a guess.
4. Where the two listeners disagree on a fact, the line turns **red**. A negation heard by one
   listener only is red too, because the other may have dropped the "not", and that is the mistake
   I fear most.
5. A phone photo of the medication box: **SAM 3.1** finds the label, the interpreter taps the right
   one, Spark reads what is printed, and anything that contradicts what was spoken is a flag.
6. A **teach-back question**, from a template that native speakers from my community review, for the interpreter to ask so
   the patient says the instruction back in their own words. This is how good interpreters already
   work; the tool just makes sure it happens on the lines that matter.
7. The interpreter **confirms or corrects every flag**. Only then is the English line final, and it
   joins a session log the interpreter can take away as notes.

**What it is not.** Teach-Back is not a medical device, gives no medical, legal or benefits advice,
does not diagnose, and never speaks to a patient. No model output reaches the person being served:
the one sentence meant for them is a human-reviewed template, read aloud by the interpreter. The
machine listens twice; a person decides.

**Who it is for.** The interpreter on the phone line, the bilingual nurse, the caseworker at a
resettlement agency, the daughter who came along to translate. Clinics first, because a wrong dose
is the fastest harm, but the same facts, dates and negations decide asylum interviews, benefits
applications and school meetings, and the same tool checks them.

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
that asserts the exact request. Screens decide nothing. I kept the models at the edges on purpose:
they are good at hearing and rendering, and I do not trust any of them, or myself, to decide a dose
without a check.

## Meta tools, and why each one

| Tool | Role | Why this one |
| --- | --- | --- |
| **Omnilingual ASR 7B** (open weights) | First listener | The one speech model with published Amharic (5.7% CER) and Afaan Oromo (7.8% CER) results. I already run it on an L4 as a Hugging Face Space for Kintale, my family-stories app for Ethiopian elders; Teach-Back reuses that service and speaks its real contract. |
| **Muse Spark 1.3** (Meta Model API) | Renders the transcript into English; reads the label crop | Reasoning model; prompts forbid adding, inferring, summarising or advising, and are unit-tested for that wording. |
| **Muse Spark 1.2** (Meta Model API) | Second listener, hears the audio directly | Audio input; reports language, transcript and English as JSON. Independent of the first listener, which is what makes a disagreement meaningful. |
| **SAM 3.1** (Meta Model API, Responses) | Finds the medication label in a phone photo | Concept segmentation from a text prompt, so the reader sees the label and not the counter top, and the interpreter picks when there are several. |
| **Muse Voice Transcribe 1.0** | Fallback first listener only | Runs when the Space is asleep (a cold start takes 15 to 25 minutes) and is named as such on the turn. Its coverage of these languages is unverified, so it is never the headline. |

## What I built during the event

All of it. The repository was created on Oct 26 and every line is new work; the day-by-day log is in
[`docs/build-log.md`](docs/build-log.md) and the reasoning behind each design decision in
[`docs/decisions.md`](docs/decisions.md). In short:

- **Core:** Ethiopian calendar, fact extraction, two-listener and label comparison, teach-back
  templates in English, Amharic and Afaan Oromo, session finalisation. 124 unit tests.
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
npm test            # unit tests (vitest)
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

No real patient data is used or stored. The test recordings are scripted sentences read by
volunteers from my own community who sign the consent form in `docs/recording-session.md`; a
recording is published only with the release box ticked, and never with a name. The draft
translations and the teach-back questions are reviewed by native speakers through `/review`, and
the repository records who signed off which language. The session log lives in the interpreter's
browser and nowhere else. Server logs carry timings and counts, never content.

## Licence

MIT. See `LICENSE`. Meta models are used under their respective terms.
