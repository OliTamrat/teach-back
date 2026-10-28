# Demo video, three minutes

One idea carries the whole film: **a dropped "not" turns a line red, and a person catches it before
it reaches anyone.** Everything else supports that moment. The video shows only features built
Oct 26 to Nov 4 in this repository, as the rules require, and every screen in it is the live site.

## Shot list

| Time | On screen | Voice |
|---|---|---|
| 0:00–0:15 | Black, then one line: "Amharic is among the top three most-served languages at DC agencies. There is no oral certification exam for medical interpreters in it." | "I am Ethiopian. I have been the interpreter in the room since I was a child. Nobody in that room can check me. Not the doctor, not my mother." |
| 0:15–0:40 | The interpreter screen on a phone, Amharic session, Patient speaks. A volunteer (not a patient) says off camera: "I have a sharp pain in my lower right back for three weeks. I am not allergic to penicillin." The two transcripts appear in Ethiopic. | "The patient says what is wrong. Two Meta models hear her: Omnilingual ASR, open weights, and Muse Spark. Code compares every fact." |
| 0:40–1:00 | The English with facts underlined. Listener B says "left" and "allergic". Two red lines. Hold on **only one listener heard a negation**. | "Here they disagree on the side, and on the one word that matters most. The line turns red. A person settles it with the patient." |
| 1:00–1:15 | The interpreter taps **Confirmed with patient** twice. Green. The final line appears, and joins the session. | "Nothing is final until a person decides every flag." |
| 1:15–1:50 | **Provider speaks English.** A second voice: "Take one tablet of 500 milligrams amoxicillin three times a day for ten days. Do not take it with milk." Step 1 turns green. Then the interpreter says it in Amharic, deliberately wrong: 50, and no "do not". Step 2. Two red lines: **interpreter changed this: dose**, **interpreter dropped this: negation**. Longest hold of the film. | "Now the doctor answers. The interpreter tells the patient in Amharic. Teach-Back hears the interpreter through the same two models, brings it back to English, and compares it with what the doctor said. Fifty instead of five hundred. The warning gone. This is the sentence that sends someone home with the wrong dose, and now it is red before she leaves." |
| 1:50–2:10 | The teach-back question in English and Amharic; the interpreter reads it; the volunteer says the instruction back. Confirmed. | "The interpreter asks the patient to say it back in her own words. That is teach-back. The tool just makes sure it happens on the lines that matter." |
| 2:10–2:30 | A medicine box photographed. SAM 3.1 draws the box; Spark reads it; the label line turns red against what the patient said she takes. | "She brought her medicine. SAM 3.1 finds the label, Spark reads it, code compares it with what she said." |
| 2:30–2:50 | `eval/latest.md`: the results table from the Oct 31 recordings. Numbers only, with the speaker count. | "We measured it. [N] speakers, [N] sentences, character error rate of [x]% in Amharic and [y]% in Afaan Oromo; [n] of [m] planted errors caught; [k] false alarms." |
| 2:50–3:00 | The README's day-by-day log scrolling. Last frame: repository URL and "Not a medical device. It does not interpret. It checks the interpreter, both ways." | "Every line was written during the event. Teach-Back advises no one and speaks to no patient. It makes sure the right words reach the right person, in both directions." |

## Rules of the cut

- Only the live site, never a mock. Every model call in the film is real, on the day of recording.
- Only scripted sentences read by consenting volunteers. No patient, no real appointment, no real name.
- Every number spoken is in `eval/latest.md`, produced by a run that can be repeated.
- No claim of medical advice, diagnosis or treatment anywhere in picture or voice.
- The provider-turn moment, 50 for 500 and the dropped "do not", gets the longest hold. If something has to be cut, cut the label.
- Captions on, because the audience may not have sound and the judges may not speak the languages.

## Recording checklist

- Space awake (`/api/health?probe=asr` reads ready) before the first take; it sleeps.
- Phone at 100% brightness, dark screen reads better in the capture than it does in daylight.
- Screen capture at phone aspect, voice recorded separately and cut to picture.
- One take per turn, kept whole. No speeding up a model call; show the real timing and say it.
- B-roll from the Oct 31 session (hands, phones, the sentence sheet), faces only with consent.
