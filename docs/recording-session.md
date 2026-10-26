# Recording session, Saturday Oct 31, 2026

What the session produces: one short clip per scripted sentence, from volunteers who read Amharic
or Afaan Oromo, so that `npm run eval` can score the whole pipeline on Nov 1. No real patient, no
real medical information, nothing improvised about anyone's health.

## What we need

| | |
|---|---|
| Volunteers | 2 to 4 per language, any age, any accent. Different voices matter more than many sentences from one voice. |
| Time per volunteer | 20 to 30 minutes: consent, 30 sentences, 5 wrong-language sentences, a short thank-you. |
| Equipment | A laptop or phone with Chrome or Safari, a quiet room, the `/record` page of the app. A headset microphone is better than a laptop microphone. |
| Output | `eval/audio/S01.webm` to `S60.webm` and `W01.webm` to `W10.webm`. Each volunteer's set goes in its own folder first (`eval/audio/v1/`, `v2/`), merged after consent is checked. |

## Running it

1. **Consent first.** Read the form below together, answer questions, both sign. Keep the paper.
   No signature, no recording. The two checkboxes decide whether a clip may be published.
2. Open `/record` on the app, choose the volunteer's language, and hand them the device.
3. The volunteer reads each sentence once, naturally, at normal speed, and presses Stop. If they
   stumble, Record again. If the draft wording is not what they would say, they say it their way
   and the helper writes the change next to the sentence number on the sheet. **These notes are the
   native review of the translations** and go back into `eval/recording-script.json` with
   `reviewed: true`.
4. The ten `W` sentences are the wrong-language items: an Afaan Oromo speaker reads W01 to W05,
   an Amharic speaker reads W06 to W10. The session will deliberately expect the other language.
5. Each Stop downloads a file named by sentence id. Move the files into `eval/audio/`, start the
   app with the services configured, and run:

   ```sh
   EVAL_SERVER_URL=http://localhost:3000 npm run eval
   ```

   The report in `eval/latest.md` gives transcript character error rate per clip, which critical
   facts survived the pipeline, and whether the wrong-language items were caught.

## What is measured

- **Transcription accuracy** per language: character error rate of the first listener's transcript
  against the text read.
- **Critical-fact survival**: of the facts in the English source, how many the pipeline's English
  rendering still contains, by type (dose, frequency, drug, negation, body part, date, duration).
- **Wrong-language detection**: of the ten `W` items, how many raised the language flag.
- **Two-listener disagreement**: how often the two listeners disagreed on a clean reading, which is
  the false-alarm rate interpreters would live with.

No number goes in the README that was not produced by a run of `npm run eval` that can be repeated
from the files in `eval/`.

## Consent form

Print one per volunteer. Two copies: one for them, one kept with the recordings.

---

**Teach-Back recording session, consent**

**What this is.** Teach-Back is a prototype built for the Meta Global AI Developer Hackathon by
Oli Tamrat. It checks machine interpreting of Amharic and Afaan Oromo in clinic settings and flags
what a human interpreter must confirm. It is not a medical product and gives no medical advice.

**What you will do.** Read about 35 short scripted sentences aloud in your language. The sentences
are invented examples of things a patient might say (a dose, a date, a body part). They are not
about you. You will not be asked anything about your own health.

**How your recordings are used.**
- To measure how accurately the software hears Amharic and Afaan Oromo.
- Short clips may be played in a three-minute demonstration video for the hackathon judges.
- With your permission below, clips may be published in the project's open repository so that
  other researchers can repeat the measurement.

**Who may see them.** Anyone, if you tick the release box; otherwise only Oli Tamrat and the
hackathon judges. Your name is never attached to a clip. Clips are stored under sentence numbers.

**Your choices.**
- [ ] My clips may be used for the measurement and in the demonstration video.
- [ ] My clips may also be published in the open repository under a Creative Commons licence (CC BY 4.0), without my name.

**You can say no.** Taking part is voluntary. You can stop at any time and ask for your clips to
be deleted, up to the day the project is submitted (Nov 4, 2026). After publication a clip cannot
be fully withdrawn from copies others may have made.

**Requirements.** You must be 18 or over.

**Contact.** Oli Tamrat, olitamrat@gmail.com.

I have read this form, my questions were answered, and I agree to take part on the terms ticked above.

Name: ________________________  Signature: ________________________  Date: ____________

Language read:  [ ] Amharic   [ ] Afaan Oromo

Helper's name: ________________________

---

## Volunteer brief, for sending ahead

> We are testing software that checks medical interpreting for Amharic and Afaan Oromo, so that a
> wrong dose or a dropped "not" gets caught before it reaches a patient. We need people to read
> about 35 short invented sentences aloud, which takes 20 to 30 minutes. Nothing about you or your
> health is recorded. The clips help measure how well the software hears our languages, and with
> your permission they help other researchers too. Saturday Oct 31, time and place to follow.
