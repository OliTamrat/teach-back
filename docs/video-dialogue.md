# Demo video: two-person dialogue script

One page. Print two copies. Three minutes, one take, live site, scripted sentences only. No real
patient.

**People.** **Oli** plays two parts, the **patient** (in Amharic) and the **interpreter** (at the
laptop, in English and Amharic), and narrates. **Boni** plays the **doctor**, in English only. He
never needs to read or hear Amharic: his cue is always Oli speaking English to him. The
interpretation errors are deliberate and are on the page. Do not improvise them.

**Before recording.** Status page green (`/status`), access code entered, Setting Clinic, language
Amharic, Listen mode on, Patient selected. Screen recording running with the microphone on. Boni
sits beside Oli so one microphone hears both. If the Space row is still yellow, switch to Paste
mode and paste the lines instead of speaking them; say so once on camera.

| Time | Who | Says | On the screen |
| --- | --- | --- | --- |
| 0:00 | Oli, to camera | I am Oli. I am Ethiopian, I speak Afaan Oromo and Amharic, and for most of my life I have been the one who goes along to the clinic or the immigration office to interpret. Nobody checks the interpreter. This does. Today my son Boni is the doctor, and I am both the patient and the interpreter. | Teach-Back home, Clinic, Amharic. |
| 0:20 | Boni, as doctor | Good morning. What brings you in today, and are you allergic to anything? | |
| 0:25 | Oli, as patient (Amharic) | ላለፉት ሦስት ሳምንታት በቀኝ ወገቤ ታችኛው ክፍል ላይ ስለታም ሕመም አለብኝ። ለፔኒሲሊን አለርጂ የለብኝም። | A turn appears, labelled Patient. |
| 0:40 | Oli, to camera | Two Meta models heard him: Omnilingual ASR, open weights, on a GPU I run, and Muse Spark. Code, not a model, pulls out the facts. Three weeks. Lower right back. Not allergic to penicillin. | The English rendering and the fact chips. |
| 0:55 | Oli, as interpreter, to Boni | He has a sharp pain in his lower right back for three weeks. He is allergic to penicillin. | Second turn, Interpreter to provider. A red line: interpreter dropped this, negation. |
| 1:05 | Oli, to camera | I dropped the "not". Teach-Back heard me too, and compared. The line is red before the doctor writes anything down. I press Correct. | Correct, the line turns final. |
| 1:15 | Boni, as doctor | All right. Take one tablet of 500 milligrams amoxicillin three times a day for ten days. Do not take it with milk. | Turn three, Provider. |
| 1:30 | Oli, as interpreter, to the patient (Amharic) | ለአሥር ቀናት በቀን ሦስት ጊዜ አንድ የ50 ሚሊግራም አሞክሲሲሊን ኪኒን ይውሰዱ። ከወተት ጋር ይውሰዱት። | Turn four, Interpreter to patient. Two red lines: dose 500 versus 50; negation dropped. |
| 1:45 | Oli, to camera | Teach-Back brought my Amharic back to English and compared it with what the doctor said. Fifty instead of five hundred. The warning gone. This is the sentence that sends someone home with the wrong dose, and now it is red before he leaves the room. The doctor never had to understand a word of Amharic. | Hold on the two red lines. The longest hold of the film. |
| 2:05 | Boni, as doctor | So what do I do when it goes red? | |
| 2:10 | Oli, to camera | Nothing. I do. I correct it, and then I ask him this: a teach-back question in Amharic. It is a template a native speaker reviews, never a model's words. He says the instruction back in his own words, and we both hear it. | The teach-back question in Amharic. |
| 2:30 | Oli, to camera | At the end I take the session log as my notes. No model output ever reaches the patient. A person confirms every flag. The tool advises no one. | Session log, copy. |
| 2:45 | Oli, to camera | Spark 1.3 and 1.2, SAM 3.1 for the medicine label, Voice Transcribe as the fallback, Omnilingual ASR: all Meta, all in the repository with the tests. The audio evaluation harness is built; it has not yet been run with volunteers, and the README says so. github.com/OliTamrat/teach-back. | README, Results section. |
| 3:00 | | End. | |

## Boni's card

Three lines. Wait for Dad to finish speaking English to you before each one. Say them like a
doctor who is slightly in a hurry.

1. *(start)* "Good morning. What brings you in today, and are you allergic to anything?"
2. *(after Dad says "he is allergic to penicillin" and presses a button)* "All right. Take one
   tablet of 500 milligrams amoxicillin three times a day for ten days. Do not take it with milk."
3. *(after Dad explains the red lines)* "So what do I do when it goes red?"

**If a turn fails:** Retry once. If it fails again, switch to Paste mode, paste the same line, keep
talking. **If anyone stumbles:** keep going. A pause is forgiven; a missing video is not.
