# Submission text

Everything the hackathon form asks for, ready to paste. The only bracket left is the video URL.
Nothing here claims a number that has not been measured.

**Project name:** Teach-Back

**Tagline (under 100 characters):** Checks the interpreter both ways, in Amharic and Afaan Oromo, before anyone acts.

**Track:** Indie Developer · **Theme:** Build for Your World

**Links:** live app https://teach-back-phi.vercel.app · repository https://github.com/OliTamrat/teach-back · video [URL]

**One paragraph (about 100 words).**
I am Ethiopian, I speak Afaan Oromo and Amharic, and for most of my life I have been the one who
goes along to the clinic or the immigration office to interpret. Errors there are invisible to
everyone but me: a dropped "not", a dose off by ten, a date from the Ethiopian calendar written as
if it were Gregorian. Teach-Back checks the interpreter in both directions. When the patient speaks, two Meta models,
Omnilingual ASR and Muse Spark, hear the Amharic and code compares what they heard. When the
provider speaks, Teach-Back records the English, then hears the interpreter's Amharic through the
same listeners and compares, fact by fact, what the provider said with what the patient was told.
SAM 3.1 reads the medicine the patient brought. A human confirms each flag. It advises no one.

**Longer description (about 300 words).**
In the Washington DC area, where I live, Amharic is among the top three most-served languages at
city agencies, after Spanish, and the courts had to create the country's first Amharic interpreter
exam because certified interpreters could not be found. There is still no oral certification exam
for medical interpreters in Amharic or Afaan Oromo. Millions of Ethiopians live outside Ethiopia,
in North America, Europe, the Gulf, Israel, Kenya, South Africa and Australia, and everywhere the
same thing happens: a family member or a phone interpreter carries a conversation on which a
diagnosis, a benefit or an asylum claim depends, and nobody can check it. Federal policy now pushes
machine translation into those rooms while leaving providers responsible for its mistakes.

Teach-Back is not that. It gives no medical advice, diagnoses nothing, and no model output ever
reaches the patient: it checks a human interpreter, in both directions, and a person decides every
flag. It is the second pair of ears I wished I had, and it listens both ways. When the patient
speaks, Omnilingual ASR, Meta's open-weights model with published results for both languages,
transcribes on a GPU I run myself; Muse Spark renders the transcript in English, and a second Spark
call hears the same audio on its own; code, never a model, extracts and compares the critical
facts: symptom, body part and side, duration, date, negation, drug, dose, frequency, number. When
the provider speaks, Teach-Back records the English, then hears the interpreter's Amharic through
the same two listeners and compares what the provider said with what the patient was told: a
changed dose, a dropped "do not", a moved follow-up date. Ethiopian dates are converted
arithmetically; an impossible date is a flag, not a guess. A dropped "not" is the error I fear
most, and it is red in both directions.

A photo of the medication box goes to SAM 3.1, which finds the label; the interpreter taps it, the
browser crops it, Spark reads it, and a contradiction with what was said is flagged. A teach-back
question from a template reviewed by native speakers lets the interpreter ask the patient to say
the instruction back. Only when a person has decided every flag is the English line final.

Every line of the repository was written during the event. The evaluation harness scores the
deterministic core over 22 text cases with planted errors: every critical fact found, 17 of 17
planted errors flagged, no false alarms. The 70 audio cases and four scripted two-person visits are
built and rehearsed on mocks, but the recording session with volunteers could not be held in the
window, so they are reported as skipped rather than guessed; the first real session fills the
results with one command. Teach-Back is not a medical device and never speaks to a patient. Clinics first, because a wrong dose is the
fastest harm; the same facts decide immigration interviews and benefits applications, and the same
tool checks them.

**Product overview: why I built Teach-Back, and how the community will use it.**

I built it because I have been the interpreter. In my family and my community, the person who
speaks the most English goes along: to the clinic, to the immigration interview, to the benefits
office, to the school meeting. Nobody trained us, nobody checks us, and the mistakes we make are
invisible to everyone in the room except us, if we even notice. A dose off by ten, a dropped "not",
an Ethiopian date written down as if it were Gregorian. Professional interpreters in our languages
are rare: there is still no oral certification exam for medical interpreters in Amharic or Afaan
Oromo, and agencies fall back on phone lines and family. Machine translation is now being pushed
into those rooms, and it fails in the same silent way. I did not want a machine that interprets
instead of us. I wanted the second pair of ears I never had.

Who uses it, and how:

- **The interpreter**, professional or family member, opens Teach-Back on a phone or laptop at the
  start of the visit and presses one button. It listens to the whole conversation, in both
  directions, and only speaks up when what the patient said and what reached the provider, or what
  the provider said and what reached the patient, disagree on a fact that matters. The interpreter
  confirms or corrects each flag. At the end they take the session log as their notes. Nothing is
  stored on a server.
- **The patient or applicant** never touches it and never hears a machine. The only sentence that
  reaches them is a teach-back question, a reviewed template read by the interpreter, asking them to
  say the instruction back in their own words. That is a practice clinics already trust; Teach-Back
  tells the interpreter when to use it.
- **Clinics, hospitals and health centres** that serve Ethiopian communities, in Washington DC,
  Minneapolis, Seattle, Toronto, London, Melbourne and the Gulf, get a record that the interpretation
  was checked, fact by fact, without hiring staff they cannot find. The Setting switch carries the
  same checks to **immigration interviews**, **benefits applications** and **school meetings**, where
  a date or a negation decides a case.
- **Community organisations and interpreter trainers** can use the session log and the flags as a
  teaching tool: the interpreter sees, in their own session, which facts they tend to drop. The
  recording and review pages let a community build its own evaluation set, with consent, in its own
  voices, so the numbers come from our speakers and not from a benchmark that never heard us.
- **Other language communities** can add a language by adding a question template file and an ASR
  language code. The facts, the calendar logic and the comparison are the same for anyone who has
  ever sat at that table.

It is open source because the people it serves should be able to read every rule it applies, and
because no single community should have to build this twice.

**Meta tools used:** Omnilingual ASR 7B (open weights, self-hosted); Muse Spark 1.3 and 1.2, SAM 3.1
and Muse Voice Transcribe 1.0 through the Meta Model API.

**What was built during the hackathon:** all of it. See `docs/build-log.md`.

**Team:** Oli Tamrat, solo. The Amharic and Afaan Oromo question templates are my own drafts and are
marked unreviewed in the product until a second native speaker signs them off through `/review`.

**Demo video:** three minutes, live site only, scripted sentences only. Script in `docs/demo-script.md`.
