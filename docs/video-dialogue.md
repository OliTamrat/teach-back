# Demo video: two-person dialogue script

One page. Print it. Three minutes, one take, live site, scripted sentences only. No real patient.

**People.** **A** is Oli: the interpreter, at the laptop, running Teach-Back and narrating. **B** is a
volunteer who plays the provider, in English. If B also speaks Amharic, B plays the patient too;
if not, A reads the patient's Amharic line, says "the patient says", and carries on. Errors in the
interpretation are deliberate and are on the page. Do not improvise them.

**Before recording.** Status page green (`/status`), access code entered, Setting Clinic, language
Amharic, Listen mode on, Patient selected. Screen recording running with the microphone on. If the
Space row is red, switch to Paste mode and paste the lines instead of speaking them; say so once.

| Time | Who | Says | On the screen |
| --- | --- | --- | --- |
| 0:00 | A | I am Oli. I am Ethiopian, I speak Afaan Oromo and Amharic, and for most of my life I have been the one who goes along to the clinic or the immigration office to interpret. Nobody checks the interpreter. This does. | Teach-Back home, Clinic, Amharic. |
| 0:20 | B as patient (or A) | ላለፉት ሦስት ሳምንታት በቀኝ ወገቤ ታችኛው ክፍል ላይ ስለታም ሕመም አለብኝ። ለፔኒሲሊን አለርጂ የለብኝም። | A turn appears, labelled Patient. |
| 0:35 | A | Two Meta models hear her: Omnilingual ASR, open weights, on a GPU I run, and Muse Spark. Code, not a model, pulls out the facts. Three weeks. Lower right back. Not allergic to penicillin. | The English rendering and the fact chips. |
| 0:50 | A as interpreter, to B | She has a sharp pain in her lower right back for three weeks. She is allergic to penicillin. | A second turn, Interpreter to provider. A red line: interpreter dropped this, negation. |
| 1:00 | A | I dropped the "not". Teach-Back heard me too and compared. The line is red. I press Correct. | Correct, the line turns final. |
| 1:10 | B as provider | Take one tablet of 500 milligrams amoxicillin three times a day for ten days. Do not take it with milk. | Turn three, Provider. |
| 1:25 | A as interpreter, in Amharic | ለአሥር ቀናት በቀን ሦስት ጊዜ አንድ የ50 ሚሊግራም አሞክሲሲሊን ኪኒን ይውሰዱ። ከወተት ጋር ይውሰዱት። | Turn four, Interpreter to patient. Two red lines: dose 500 versus 50; negation dropped. |
| 1:40 | A | Teach-Back brought my Amharic back to English and compared it with what the doctor said. Fifty instead of five hundred. The warning gone. This is the sentence that sends someone home with the wrong dose, and now it is red before she leaves. Nobody waited for it. | Hold on the two red lines. The longest hold of the film. |
| 2:05 | A | I correct it, and this is the one sentence meant for the patient: a teach-back question. It is a template a native speaker reviews, not a model's words. I read it; she says the instruction back. | The teach-back question in Amharic. |
| 2:25 | A | At the end I take the session log with me. No model output ever reaches the patient. A person confirms every flag. The tool advises no one. | Session log, copy. |
| 2:40 | A | Spark 1.3 and 1.2, SAM 3.1 for the medicine label, Voice Transcribe as the fallback, and Omnilingual ASR, all Meta, all in the repository with the tests. The audio evaluation harness is built; it has not yet been run with volunteers, and the README says so. github.com/OliTamrat/teach-back. | README, Results section. |
| 3:00 | | End. | |

**If a turn fails:** Retry once. If it fails again, switch to Paste mode, paste the same line, keep
talking. **If you stumble:** keep going. A pause is forgiven; a missing video is not.
