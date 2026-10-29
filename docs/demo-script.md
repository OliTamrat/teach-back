# Demo video, three minutes

One idea carries the whole film: **a dropped "not" turns a line red, and a person catches it before
it reaches anyone.** Everything else supports that moment. The video shows only features built
Oct 26 to Nov 4 in this repository, as the rules require, and every screen in it is the live site.

## Shot list

| Time | On screen | Voice |
|---|---|---|
| 0:00–0:15 | Black, then one line: "Amharic is among the top three most-served languages at DC agencies. There is no oral certification exam for medical interpreters in it." | "I am Ethiopian. I have been the interpreter in the room since I was a child. Nobody in that room can check me. Not the doctor, not my mother." |
| 0:15–0:30 | The screen on a laptop, Light appearance, Amharic session. One tap: **Start listening**. The phone goes down on the table. Nobody touches it again. | "Teach-Back is one button. Everyone just talks." |
| 0:30–0:55 | A volunteer (not a patient) says in Amharic: "I have a sharp pain in my lower right back for three weeks. I am not allergic to penicillin." The turn appears, labelled Patient. The interpreter says it in English; a second turn appears, labelled Interpreter to the provider, with the interpretation deliberately wrong: "allergic to penicillin". A red line: **interpreter dropped this: negation**. | "The patient says what is wrong. Two Meta models hear her: Omnilingual ASR, open weights, and Muse Spark. The interpreter tells the doctor. Teach-Back hears the interpreter too, and compares. The 'not' is gone. The line is red." |
| 0:55–1:10 | The interpreter taps **Confirmed with patient** after asking her. Green. The lock on the record counts down. | "A person settles it with the patient. Nothing is final until a person decides every flag." |
| 1:10–1:50 | The provider, in English: "Take one tablet of 500 milligrams amoxicillin three times a day for ten days. Do not take it with milk." Turn three, Provider. The interpreter says it in Amharic, wrong on purpose: 50, and no "do not". Turn four, Interpreter to the patient. Two red lines: **interpreter changed this: dose, 500 milligrams versus 50 milligrams**, **interpreter dropped this: negation**. Longest hold of the film. The time per turn is visible beside it. | "Now the doctor answers. The interpreter tells the patient in Amharic. Teach-Back brings the Amharic back to English and compares it with what the doctor said. Fifty instead of five hundred. The warning gone. This is the sentence that sends someone home with the wrong dose, and now it is red before she leaves. About five seconds behind the conversation, and nobody waited for it." |
| 1:50–2:05 | The teach-back question in English and Amharic; the interpreter reads it; the volunteer says the instruction back. Confirmed. The record unlocks. | "The interpreter asks the patient to say it back in her own words. That is teach-back. The tool makes sure it happens on the lines that matter, and keeps the record." |
| 2:05–2:25 | A medicine box photographed from the left rail. SAM 3.1 draws the box; Spark reads it; the label line turns red on the patient's turn against what she said she takes. | "She brought her medicine. SAM 3.1 finds the label, Spark reads it, code compares it with what she said." |
| 2:25–2:45 | The Results page on the live site: the table from the Oct 31 recordings, speaker count, the visits block. Numbers read plainly. | "We measured it. [N] speakers, [N] clips, character error rate of [x]% in Amharic and [y]% in Afaan Oromo; in scripted visits, [n] of [m] planted interpreter errors flagged, [k] false alarms." |
| 2:45–3:00 | The README's day-by-day log scrolling. Last frame: repository URL and "Not a medical device. It does not interpret. It checks the interpreter, both ways." | "Every line was written during the event. Teach-Back advises no one and speaks to no patient. It makes sure the right words reach the right person, in both directions." |

## Rules of the cut

- Only the live site, never a mock. Every model call in the film is real, on the day of recording.
- Only scripted sentences read by consenting volunteers. No patient, no real appointment, no real name.
- Every number spoken is in `eval/latest.md`, produced by a run that can be repeated.
- No claim of medical advice, diagnosis or treatment anywhere in picture or voice.
- The provider-turn moment, 50 for 500 and the dropped "do not", gets the longest hold. If something has to be cut, cut the label.
- Captions on, because the audience may not have sound and the judges may not speak the languages.

## Recording checklist

- Space awake (`/api/health?probe=asr` reads ready) before the first take; it sleeps. Raise its sleep timer for the day.
- Pause setting on Normal; rehearse the four lines once so the pauses land; use Cut turn only if the room is loud.
- Phone at 100% brightness, dark screen reads better in the capture than it does in daylight.
- Screen capture at phone aspect, voice recorded separately and cut to picture.
- One take per turn, kept whole. No speeding up a model call; show the real timing and say it.
- B-roll from the Oct 31 session (hands, phones, the sentence sheet), faces only with consent.
