# Submission text

Everything the hackathon form asks for, ready to paste. Bracketed items are filled on Nov 3 from
`eval/latest.md` and the video upload. Nothing here claims a number that has not been measured.

**Project name:** Teach-Back

**Tagline (under 100 characters):** A second pair of ears for interpreters in Amharic and Afaan Oromo.

**Track:** Indie Developer · **Theme:** Build for Your World

**Links:** live app https://teach-back-phi.vercel.app · repository https://github.com/OliTamrat/teach-back · video [URL]

**One paragraph (about 100 words).**
I am Ethiopian, I speak Afaan Oromo and Amharic, and for most of my life I have been the one who
goes along to the clinic or the immigration office to interpret. Errors there are invisible to
everyone but me: a dropped "not", a dose off by ten, a date from the Ethiopian calendar written as
if it were Gregorian. Teach-Back listens alongside the interpreter with two Meta models, Omnilingual
ASR and Muse Spark; code marks every fact that would hurt someone if it were wrong; SAM 3.1 reads
the medication label; and a human confirms each flag before anything is written down. It advises no
one.

**Longer description (about 300 words).**
In the Washington DC area, where I live, Amharic is among the top three most-served languages at
city agencies, after Spanish, and the courts had to create the country's first Amharic interpreter
exam because certified interpreters could not be found. There is still no oral certification exam
for medical interpreters in Amharic or Afaan Oromo. Millions of Ethiopians live outside Ethiopia,
in North America, Europe, the Gulf, Israel, Kenya, South Africa and Australia, and everywhere the
same thing happens: a family member or a phone interpreter carries a conversation on which a
diagnosis, a benefit or an asylum claim depends, and nobody can check it. Federal policy now pushes
machine translation into those rooms while leaving providers responsible for its mistakes.

Teach-Back is the second pair of ears I wished I had. The patient speaks; Omnilingual ASR, Meta's
open-weights model with published results for both languages, transcribes on a GPU I run myself.
Muse Spark renders the transcript in English, and a second Spark call hears the same audio on its
own. Code, never a model, extracts and compares the critical facts: dose, frequency, drug, negation,
body part and side, date, duration. Ethiopian dates are converted arithmetically; an impossible
date is a flag, not a guess. A disagreement between the listeners is a red line, and so is a
negation only one of them heard, because a dropped "not" is the error I fear most.

A photo of the medication box goes to SAM 3.1, which finds the label; the interpreter taps it, the
browser crops it, Spark reads it, and a contradiction with what was said is flagged. A teach-back
question from a template reviewed by native speakers lets the interpreter ask the patient to say
the instruction back. Only when a person has decided every flag is the English line final.

Every line of the repository was written during the event. The evaluation ran on scripted sentences
read by consenting volunteers from my community: [N] speakers, [N] clips, [x]% character error rate
in Amharic and [y]% in Afaan Oromo, [n] of [m] planted errors caught, [k] false alarms. Teach-Back
is not a medical device, gives no advice, and never speaks to a patient. Clinics first, because a
wrong dose is the fastest harm; the same facts decide immigration interviews and benefits
applications, and the same tool checks them.

**Meta tools used:** Omnilingual ASR 7B (open weights, self-hosted); Muse Spark 1.3 and 1.2, SAM 3.1
and Muse Voice Transcribe 1.0 through the Meta Model API.

**What was built during the hackathon:** all of it. See `docs/build-log.md`.

**Team:** Oli Tamrat, solo. Native-speaker review of translations by [names, with permission].

**Demo video:** three minutes, live site only, scripted sentences only. Script in `docs/demo-script.md`.
