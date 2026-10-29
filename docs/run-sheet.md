# Run sheet, Saturday Oct 31

Print this. One page. Everything else is in `docs/recording-session.md`.

## Before anyone arrives (30 minutes ahead)

1. On Hugging Face, open the Space and raise its sleep timer for the day.
2. Open `/status` on the live site. Leave it open. All three rows green before the first volunteer.
3. Laptop charged, headset microphone plugged in, a quiet room, the consent forms printed, two per
   volunteer, pens.
4. Open `/record` in a second tab. Type the volunteer's first name or number in the Volunteer box.
5. Pause setting is not on this page; it matters only in listening mode.

## Each volunteer (20 to 30 minutes)

1. Consent: read the form together, both sign, keep one copy. No signature, no recording.
2. Choose their language's lines on `/record`. Order: **Visits only** first (the two-way scripts,
   20 lines including the planted takes, with the role shown on each), then their single
   sentences, then the W items if they are the right speaker.
3. They read each line once, naturally, and press Stop. Stumble: Record again. If the draft wording
   is not what they would say, they say it their way and the helper writes the change on the sheet.
4. Planted takes say "reading it deliberately wrong": they read exactly what is written.
5. **Before the next volunteer: press "Download this volunteer's clips as one file."** The clips live
   in that tab only; closing it loses them. Keep the zip on the laptop, named for them.
6. If they agreed to review, open `/review` in their language, their name in the box, and let them go
   through the questions and the sentences. Download the review file. Same rule: before the next
   person.

## After the last volunteer

1. Unzip each volunteer's folder into `eval/audio/` (the clips are named by case id; a second
   volunteer's clip of the same sentence overwrites the first, so keep the zips and choose).
2. Apply each review file: `npm run review:apply -- <file>`.
3. Local server with the services configured and `TEACH_BACK_PER_MINUTE=1000`, Space awake, then:
   `EVAL_SERVER_URL=http://localhost:3000 EVAL_SPEAKERS=<n> npm run eval && npm run results`
4. Read `eval/latest.md` before believing it. Skipped rows name their reason.
5. Commit `eval/latest.md`, `eval/latest.json`, `README.md` and `docs/submission.md` together. CI
   checks the README matches the run.
6. Lower the Space's sleep timer again.

## If

- **Space will not wake:** record anyway. The clips are files; the measurement runs when it wakes.
- **A volunteer withdraws:** delete their zip. Rerun the harness. Let the numbers change.
- **Laptop dies mid-session:** the last downloaded zip is safe; the current volunteer's clips since
  the last download are gone. Download often.
