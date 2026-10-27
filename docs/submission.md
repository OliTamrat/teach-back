# Submission text

Everything the hackathon form asks for, ready to paste. Bracketed items are filled on Nov 3 from
`eval/latest.md` and the video upload. Nothing here claims a number that has not been measured.

**Project name:** Teach-Back

**Tagline (under 100 characters):** A safety net for medical interpreting in Amharic and Afaan Oromo.

**Track:** Indie Developer · **Theme:** Build for Your World

**Links:** live app https://teach-back-phi.vercel.app · repository https://github.com/OliTamrat/teach-back · video [URL]

**One paragraph (about 100 words).**
When interpreting goes wrong in a clinic, nobody in the room can see it. Teach-Back listens to a
patient in Amharic or Afaan Oromo with two Meta models, Omnilingual ASR and Muse Spark, and code
marks every fact that would hurt someone if it were wrong: a dose, a drug, a frequency, a date in
the Ethiopian calendar, a "not". Where the two listeners disagree, the line turns red. SAM 3.1 finds
the medication label in a photo so what was said can be checked against what is printed. A
qualified interpreter confirms or corrects every flag before anything is final. It advises no one.

**Longer description (about 300 words).**
Amharic is among the top three most-served languages at Washington DC agencies, after Spanish, and
neither it nor Afaan Oromo has a medical interpreter certification. Errors in interpreted care are
invisible to everyone present, and federal policy has moved toward machine translation while
providers remain responsible for its mistakes. Teach-Back is built for that room.

The patient speaks. Omnilingual ASR, Meta's open-weights model with published results for both
languages, transcribes on a self-hosted GPU. Muse Spark renders the transcript into English, and a
second Spark call hears the same seconds of audio independently. Code, never a model, extracts the
critical facts from both renderings and compares them: dose, frequency, drug name, negation, body
part and side, date, duration. Ethiopian dates are converted arithmetically; a date that does not
exist is a flag, not a guess. A disagreement on any fact is a red line. A negation heard by only
one listener is red too, because a dropped "not" is the most dangerous single error in interpreting.

A phone photo of the medication label goes to SAM 3.1, which finds the label; the interpreter taps
the right one, the browser crops it, Spark reads what is printed, and a contradiction with what was
spoken is another flag. A teach-back question from a human-reviewed template, in English and in
the patient's language, lets the interpreter ask the patient to say the instruction back. Only when
a person has confirmed or corrected every flag is the English line final.

Every line of the repository was written during the event; the day-by-day log and the decisions
record are in the repo. The evaluation harness scores the system on scripted sentences read by
consenting volunteers: [N] speakers, [N] clips, [x]% character error rate in Amharic and [y]% in
Afaan Oromo, [n] of [m] planted errors caught, [k] false alarms. Teach-Back is not a medical
device, gives no advice, and never addresses a patient.

**Meta tools used:** Omnilingual ASR 7B (open weights, self-hosted); Muse Spark 1.3 and 1.2, SAM 3.1
and Muse Voice Transcribe 1.0 through the Meta Model API.

**What was built during the hackathon:** all of it. See `docs/build-log.md`.

**Team:** Oli Tamrat, solo. Native-speaker review of translations by [names, with permission].

**Demo video:** three minutes, live site only, scripted sentences only. Script in `docs/demo-script.md`.
