# Demo video, three minutes

One idea carries the whole film: **a dropped "not" turns a line red, and a person catches it before
it reaches anyone.** Everything else supports that moment. The video shows only features built
Oct 26 to Nov 4 in this repository, as the rules require, and every screen in it is the live site.

## Shot list

| Time | On screen | Voice |
|---|---|---|
| 0:00–0:15 | Black, then one line of text: "Amharic is among the top three most-served languages at DC agencies. There is no certification for medical interpreters in it." | "In Washington DC, thousands of clinic visits a year happen through an interpreter in Amharic or Afaan Oromo. Nobody in the room can check the interpreting. Neither can the patient." |
| 0:15–0:35 | The interpreter screen on a phone, Amharic session. A volunteer (not a patient) says one sentence off camera: "I am not allergic to penicillin." The Record button, the two transcripts appear in Ethiopic. | "Teach-Back listens twice. Meta's Omnilingual ASR, open weights, hears the patient. Muse Spark hears the same seconds of audio on its own." |
| 0:35–1:00 | The English rendering with facts underlined. Listener B's rendering reads "I am allergic." The negation line turns red: **only one listener heard a negation; the other may have dropped the "not"**. Hold on it. | "Here the two disagree on the one word that matters. Nothing is decided by a model. The line turns red, and the interpreter confirms with the patient." |
| 1:00–1:20 | The teach-back question appears in English and Amharic. The interpreter reads it aloud; the volunteer answers; the interpreter taps **Confirmed with patient**. The line turns green. The final line appears. | "The interpreter asks the patient to say it back in their own words. Only when a person has decided every flag is the English line final." |
| 1:20–1:45 | A second turn: "The fever started on Tikimt 3." The date chip shows October 13, 2026 with the Ethiopian date beside it. Then Paste text with "Pagume 6 2018": **date does not exist**. | "Ethiopian dates are converted by code, never guessed by a model. A date that does not exist is a flag, not a best effort." |
| 1:45–2:15 | The phone photographs a medication label. SAM 3.1 draws two boxes; the interpreter taps the right one; Spark reads it; the label line turns red: **the patient said two tablets, the label reads one tablet**. | "SAM 3.1 finds the label in the photo. Spark reads it. Code compares it with what was said. The interpreter settles it before the patient leaves." |
| 2:15–2:40 | `eval/latest.md` on screen: the results table from the Oct 31 recordings. Numbers only, read out plainly, with the speaker count. | "We measured it. [N] speakers, [N] scripted sentences, character error rate of [x]% in Amharic and [y]% in Afaan Oromo; [n] of [m] planted errors caught; [k] false alarms." |
| 2:40–3:00 | The session export as notes. Then the README's day-by-day log scrolling. Last frame: repository URL and "Not a medical device. A safety net for interpreters." | "Every line in this repository was written during the event, and the log says what was built each day. Teach-Back does not advise anyone. It makes sure the right words reach the right person." |

## Rules of the cut

- Only the live site, never a mock. Every model call in the film is real, on the day of recording.
- Only scripted sentences read by consenting volunteers. No patient, no real appointment, no real name.
- Every number spoken is in `eval/latest.md`, produced by a run that can be repeated.
- No claim of medical advice, diagnosis or treatment anywhere in picture or voice.
- The dropped "not" moment gets the longest hold. If something has to be cut, cut the calendar.
- Captions on, because the audience may not have sound and the judges may not speak the languages.

## Recording checklist

- Space awake (`/api/health?probe=asr` reads ready) before the first take; it sleeps.
- Phone at 100% brightness, dark screen reads better in the capture than it does in daylight.
- Screen capture at phone aspect, voice recorded separately and cut to picture.
- One take per turn, kept whole. No speeding up a model call; show the real timing and say it.
- B-roll from the Oct 31 session (hands, phones, the sentence sheet), faces only with consent.
