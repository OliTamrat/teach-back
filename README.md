# Teach-Back

A safety net for medical interpreting in Amharic and Afaan Oromo.

When interpreting goes wrong in a clinic, nobody in the room can see it: the patient cannot read
the English and the clinician cannot hear the Amharic. Teach-Back listens to the patient, renders
what they said in English, and stops on every fact that would hurt someone if it were wrong, a
dose, a drug name, a frequency, a date, a "not", a body part, until a qualified interpreter
confirms it. Two Meta models hear the same audio; where they disagree, the line turns red.

**What it is not.** Teach-Back is not a medical device, does not give medical or health advice,
does not diagnose, and does not tell a patient what to do. It flags lines for a qualified human to
confirm. Nothing becomes final until a person confirms or corrects each flag.

Built for the **Meta Global AI Developer Hackathon**, Oct 26 to Nov 4, 2026, by Oli Tamrat
(Indie Developer track, theme: Build for Your World).

## What was built during the hackathon (Oct 26 to Nov 4, 2026)

Everything in this repository was written during the event. The log is kept day by day so judges
can tell what is new.

| Day | Date | Shipped |
| --- | --- | --- |
| 1 | Oct 26 | Repository created. Deterministic core: Ethiopian calendar conversion (`src/core/calendar.ts`), critical-fact extraction (`facts.ts`), two-listener comparison, label check and language-mismatch flags (`compare.ts`), teach-back question templates (`question.ts`), 71 unit tests. Interpreter screen in text mode (`src/app/Interpreter.tsx`). Health endpoint. |
| 2 | Oct 26 | Audio path. Browser recorder, one patient turn per clip (`Interpreter.tsx`, Record tab). `POST /api/turn` runs both listeners in parallel: Omnilingual ASR over its HTTP contract (`src/server/asr.ts`) with Muse Spark 1.3 rendering the transcript into English, and Muse Spark 1.2 hearing the same audio directly and reporting language, transcript and English as JSON (`src/server/meta.ts`). Prompts are pure and tested (`src/core/prompts.ts`): they ask the models to render, never to advise or convert a date. Script-and-lexicon language fallback (`src/core/language.ts`). Either listener may be missing; the response says which and why, and the screen shows it. 80 unit tests. Verified end to end against local mocks of both services and a fake microphone in headless Chromium; the real services connect when the keys are in place. |

Before the event, a throwaway test harness explored the same ideas (calendar logic, token budgets,
model ids). None of its code is in this repository; the ideas were re-implemented here from scratch.

## How it works

1. **Patient speaks** in Amharic or Afaan Oromo. Omnilingual ASR (Meta, open weights) transcribes.
2. **Language check.** If the spoken language does not match the session, a warning fires at once.
3. **English rendering with every critical fact marked:** dose, frequency, drug, negation, body part and side, date, duration. Extraction is code (`src/core/facts.ts`), and every fact keeps the exact words it came from.
4. **Ethiopian dates are converted by code**, never by a model (`src/core/calendar.ts`). A date that does not exist, such as Pagume 6 in a non-leap year, is a flag, not a guess.
5. **Second listener.** Muse Spark (Meta Model API) hears the same audio. Where the two listeners disagree on a critical fact, the line turns red.
6. **Label check.** SAM 3.1 finds the medication label in a phone photo; Muse Spark reads it; a contradiction with what was spoken is a flag.
7. **Teach-back question** for the interpreter to ask, so the patient says the instruction back in their own words.
8. **The reviewer confirms or corrects every flag.** Only then is the English summary final.

Steps 1, 2 and 5 are wired (Day 2) and run as soon as `META_MODEL_API_KEY` and `ASR_SERVICE_URL` are set. Step 6 connects on Day 5. Steps 3, 4, 7 and 8 work offline, and the Paste text tab exercises them without any key.

## Run it

```sh
npm install
npm test          # core unit tests (vitest)
npm run typecheck
npm run dev       # http://localhost:3000
```

Copy `.env.example` to `.env.local` for the model keys (`META_MODEL_API_KEY` for both Spark listeners, `ASR_SERVICE_URL` for Omnilingual ASR). The core and the Paste text tab need no key at all; the Record tab works with whichever listener is configured and says which one is missing.
`GET /api/health` reports what is configured without printing a secret.

## Layout

```
src/core/      pure, tested logic: calendar, facts, compare, question. No I/O.
src/app/       Next.js app: the interpreter screen and API routes. Screens call the core; they decide nothing themselves.
```

## Evaluation

Measured results replace this section on Nov 1. The plan: 60 scripted clinic sentences, 30 Amharic and 30 Afaan Oromo, read by consenting volunteers; report transcription accuracy per language, the critical-fact error rate of unchecked machine interpreting, Teach-Back's catch rate, its false-flag rate, and wrong-language detection. No number appears here that was not produced by a run that can be repeated.

## Data and consent

No real patient data is used or stored. Test recordings are scripted sentences read by volunteers who sign a consent form; the recordings are released only with that consent.

## Licence

MIT. See `LICENSE`. Open-source components keep their own licences; Meta models are used under their respective terms.
