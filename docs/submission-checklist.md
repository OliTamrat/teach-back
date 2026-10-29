# Submission week, Oct 28 to Nov 4

The code is done for the demo as designed. What remains touches the world: live calls, recordings,
numbers, video, form. Each line names who does it and what it depends on, so nothing waits on a
question nobody asked. Times are Eastern. Hard deadline Nov 4, 9:00 PM; internal deadline noon.

## Before Oct 31

- [ ] **Keys in place, live turn done** (Oli, or the terminal session from `docs/handover-terminal-agent.md`). Depends on nothing. Everything below the recording session depends on it.
- [ ] Request shapes confirmed or corrected on the first live call: Spark audio, Spark image, SAM Responses, Voice Transcribe. Tests green after any fix.
- [ ] `TEACH_BACK_ACCESS_CODE` set on Vercel before the URL goes anywhere public.
- [ ] Volunteers confirmed: two to four per language. Brief sent (bottom of `docs/recording-session.md`).
- [ ] Reviewers named: one native speaker per language, with permission to carry their name in the data files.
- [ ] Two or three medication label photos taken, personal details covered, tried through Find label and Read this label.
- [ ] Medical clause from the Discord rules copied into this folder as `rules-medical-clause.md` and the framing re-read against it.
- [ ] Consent forms printed, two per volunteer.

## Oct 31, recording session

- [ ] Space awake before the first volunteer (`/api/health?probe=asr`). It sleeps after idle time; open it 30 minutes ahead.
- [ ] Each volunteer: consent, `/record` in their language, clips kept in a folder per volunteer until consent is checked.
- [ ] Each reviewer: `/review` in their language, file sent the same day.
- [ ] Wrong-language items W01 to W10 recorded by the right speakers.
- [ ] B-roll for the video, faces only with consent.

## Nov 1, measurement

- [ ] Reviews applied: `npm run review:apply -- <file>` per file. Question templates show as reviewed on the screen.
- [ ] Clips in `eval/audio/`, local server started with `TEACH_BACK_PER_MINUTE=1000` and the services configured, Space awake, then `EVAL_SERVER_URL=http://localhost:3000 EVAL_SPEAKERS=<n> npm run eval && npm run results`. The run takes about ten seconds per clip; ninety clips is fifteen minutes. Keep the Space awake for it.
- [ ] Read `eval/latest.md` before believing it: a clip that failed to upload or a Space that fell asleep mid-run shows as skipped, not as a result. Rerun those.
- [ ] Commit `eval/latest.md`, `eval/latest.json`, README Results block and `docs/submission.md` together. CI checks the README block matches the run.
- [ ] Decide on the numbers honestly: if a figure is poor, it goes in as measured with one sentence on why. A measured weak number beats an unmeasured strong claim with every judge who reads code.

## Nov 2, deploy and harden

- [ ] Production redeploy from `main`; health green; access code works; caps sensible for judging traffic (raise `TEACH_BACK_PER_DAY` if judges will test for a week).
- [ ] Walk the five-step walkthrough on the live site on a phone and a laptop, as a stranger would.
- [ ] One full live turn, one label photo, one session export, all on production.
- [ ] Clips with release consent copied into `eval/audio/` and committed; the rest stay out. Reviewer names only in the data files.

## Nov 3, video and text

- [ ] Record the video per `docs/demo-script.md`: live site only, scripted sentences only, captions on, numbers read from `eval/latest.md`.
- [ ] Fill the brackets in `docs/submission.md`: video URL, reviewer names, the results sentence (already written by `npm run results`).
- [ ] README read top to bottom once as a judge: problem, what it does, what it is not, architecture, tools, results, run it. Fix anything that assumes knowledge.
- [ ] Final build log entry and decisions entry for anything that changed since Day 9.

## Nov 4, submit by noon

- [ ] Repository public, `main` green in CI, no `.env.local`, no secrets in history (`git log -p | grep -i "sk_\|hf_\|whsec"` returns nothing).
- [ ] Form fields pasted from `docs/submission.md`. Access code included for judges in the field the form provides for notes.
- [ ] Links opened in a private window: live site loads, walkthrough opens, repository renders the README and the mermaid diagram.
- [ ] Submit. Screenshot the confirmation. Stop pushing to `main` after submission unless the rules say updates are allowed.

## If something breaks on the day

- Space will not wake: the Voice Transcribe fallback carries the demo, named as such; say so in the video rather than hide it.
- Meta API down or credit gone: Paste text and the walkthrough still demonstrate the core; the video uses recordings made earlier.
- A volunteer withdraws: delete their clips, rerun `npm run eval`, let the numbers change.
