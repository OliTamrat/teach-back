# Decisions on record

Each entry says what was decided, why, and what would make us revisit it.

## 1. Hearth, dark, with a stricter layout (Oct 26)

Teach-Back uses the Hearth design language of Kintale and Kinfolio: one dark surface, an ambient
wash, apricot as the single accent, Instrument Serif for headings, Schibsted Grotesk for text,
DM Mono for figures, Noto Ethiopic for Amharic. The tokens were re-typed into `src/app/globals.css`;
no Kintale code is in this repository.

What changes for an interpreter is the layout, not the palette: one patient turn at a time, the
English rendering large with every critical fact underlined, flags in red that cannot be missed,
nothing decorative. The status colours are the only colour on the screen besides the accent.

A light default was considered on Oct 26, on the grounds that an exam room is lit and a video
compresses dark screens badly. The owner chose to keep dark so the app reads as part of the same
family as Kintale and Kinfolio. Revisit if interpreters in the Oct 31 session say the screen is
hard to read in daylight; the change is confined to the tokens in `globals.css`.

## 2. A negation heard by one listener only is critical (Oct 26)

Where the two listeners disagree on a value, the flag is critical; where one simply heard a fact
the other missed, it is a warning. Negation is the exception: "I am allergic" against "I am not
allergic" does not look like a disagreement to the extractor, because one side has no negation at
all. It is the most dangerous single error in interpreting, so a negation heard by one listener
only is flagged as critical, with a message saying the other listener may have dropped the "not".
Found by the evaluation harness on its first run. Revisit if real recordings show the second
listener routinely paraphrasing negations into positive forms, which would make this flag noisy.

## 3. A disagreement needs a value on each side (Oct 26)

Two listeners phrasing the same dose differently ("one tablet of metformin" against "one metformin
tablet") used to raise a critical disagreement because one extraction found a tablet count the
other missed. A disagreement now requires each listener to hold a value of that type the other
lacks; otherwise it is a single-listener warning. The harness showed the false alarm on a case
where both renderings were correct. Revisit if the warning turns out to hide real misses.

## 4. The evaluation harness scores code first, models later (Oct 26)

Text cases with known truth score the deterministic core on its own, so a regression in extraction
or flagging shows up before any recording exists. Audio cases, added after the Oct 31 session,
score the whole pipeline and need the services configured. The same scorer runs both, so the two
numbers are comparable. Truth values are written by hand, and the first run caught two mistakes in
the truth itself (an Afaan Oromo month is the second month, not the third; next year's Tikimt 5 is
October 16 because Ethiopian 2019 is a leap year). The code was right both times.

## 5. The patient-language question is a template, shown as a draft until reviewed (Oct 26)

The teach-back question is the one thing on the screen meant to be said to the patient, so it is
the one thing that must never come from a model. The Amharic and Afaan Oromo versions are fixed
templates per fact type in `src/core/question-i18n.ts`, written in the polite second person. Until
a native speaker signs them off (`REVIEWED`), the screen shows them muted, labelled as drafts, and
tells the interpreter to read them only if they agree with the wording. The volunteers on Oct 31
are the first reviewers: where they would say a sentence differently, that is recorded on the sheet
and the template changes. Revisit if reviewers want the questions to vary by region or register.

## 6. Audio cases that cannot run are skipped, never failed (Oct 26)

The harness carries 70 audio cases from the day the script exists, before a single recording does.
A missing recording or an unconfigured server marks the case skipped and leaves it out of every
rate, so the text cases keep guarding the core while the audio set fills in. A skipped case is
listed by name in the report, so nobody can mistake an empty audio set for a passing one.

## 7. The ASR adapter follows the service's code, not anyone's memory of it (Oct 27)

Two independent descriptions of the Omnilingual Space's contract, the Day 2 adapter and a partner's
resource pack, both said multipart upload with a `language` form field. The service's own code
says otherwise: raw audio body, `X-Language-3: amh_Ethi | orm_Latn`, a Hugging Face read token,
and segments with no top-level text. The adapter was rewritten to that and tested against a fake
fetch that asserts every header. Rule going forward: an integration is written from the other
side's code or a live call, never from a summary.

## 8. Voice Transcribe is a named fallback, never the headline listener (Oct 27)

The Space sleeps and takes 15 to 25 minutes to wake. A demo or a judge's test that lands on a cold
Space would show nothing, so Meta's hosted Voice Transcribe runs as the first listener only when
Omnilingual is asleep or unconfigured, and the turn says so in plain words. Its Amharic and Afaan
Oromo coverage is unverified, which is why it cannot be the story. Set `META_VOICE_FALLBACK=off`
to disable it entirely, for an evaluation run that must measure Omnilingual alone.

## 9. The reviewer picks the label box; the browser crops (Oct 27)

SAM 3.1 finds the label; when it finds several, the person chooses, and when it finds none, the
whole photo is read. The crop is made in the browser from the box the reviewer sees, so the server
needs no image library and the reader is shown exactly what the reviewer approved. This keeps the
label path on the same footing as the rest of the product: the model proposes, the person decides.

## 10. A public URL is guarded, open by default, capped regardless (Oct 27)

The live site spends a shared $150 credit on every recorded turn and label photo. Three layers
guard it: an optional access code asked once per device (judges and reviewers get it with the
submission; Paste text never needs it), a per-caller limit per minute, and a daily cap per server
instance. The code is the real protection; the caps stop an accident, and on serverless hosting
they are per instance, which is why health shows the counts. Unset, the routes are open and health
says so, because a demo that asks a judge for a password before the first screen is a demo that
gets skipped. Revisit the daily cap once the first live turns show what a turn costs.

## 11. Results are generated from a run, never typed (Oct 27)

The README's Results block and the submission sentence are written by `npm run results` from
`eval/latest.json`, which only `npm run eval` writes. Until audio cases have run, the generator
writes a placeholder that says so in its first line. This closes the easiest way to overstate a
hackathon project: a number in the README that no run produced.

## 12. Native review goes through a file, not a chat (Oct 27)

A reviewer's corrections arrive as one JSON file from `/review`, carrying their name and date, and
are applied by a script that refuses the whole file on any problem. The script and the templates
then carry `reviewed`, `reviewer` and `reviewedOn`, so the screen can stop calling a question a
draft, and so a judge can see who signed off which language. Reviewers' names stay in the
repository data with their permission and never on the website.

## 13. An outside review before anything goes live (Oct 27)

Before the first live call, the source was reviewed by a reader who had not written it. Ten
findings came back and every one was a real defect, several of them the kind a demo would hit: a
decimal comma turning 2,5 mg into 25 mg, a corrected dose vanishing from the final line because the
negation around it was corrected too, a third language never raising a flag. All are fixed with
tests that name the finding. The lesson is recorded so it is repeated: the author's own walkthroughs
test what the author imagined, and the week before submission is when someone else should read it.

## 14. Spoonfuls and grams are normalised before comparison (Oct 27)

A metric teaspoon is 5 ml and a tablespoon 15 ml; a gram is 1,000 mg. The comparison converts
these before deciding whether a spoken dose and a printed one agree, because "one teaspoon" against
"5 ml" is agreement, not a conflict, and a flag that cries wolf there teaches an interpreter to
ignore the red ones. No other unit is converted: a tablet count is never set against a strength.

## 15. CI keeps the README honest (Oct 27)

Every push runs the tests, the typecheck, the harness and the build, and then regenerates the
Results block and fails if the README would change. A number can enter the README only through a
run, and the check makes sure nobody edits it by hand afterwards.

## 16. The setting changes the order, never the rules (Oct 27)

Clinic, Immigration and Human services are three orderings of the same fact types, chosen by the
interpreter on the screen: which fact the teach-back question confirms first. Extraction, comparison
and the human gate are identical in all three, and nothing in any setting advises anyone or decides
a case. Numbers (counts, ages, money, years) were added because they decide an asylum interview or
a benefits application the way a dose decides a prescription. A bare year is kept with a warning
rather than converted, because a year said without its calendar is exactly the thing an officer
writes down wrong.

## 17. Teach-Back holds its own Hugging Face token (Oct 27)

The Space is Kintale's private `onekoo/kintale-asr`, reused rather than copied: a second Space is a
second 30 GB download, a second cold start and a second GPU bill for the same model. The credential
is not shared. Hugging Face shows a token's value once at creation and masks it afterwards, and
Vercel stores Kintale's `TRANSCRIBE_TOKEN` as a sensitive variable, which no route reads back —
`env pull`, the API and the dashboard all refuse. Refreshing it to read it would rotate the value
and lock Kintale out of its own Space until its variable was updated and redeployed. So Teach-Back
mints a Read token of its own. Two tokens also keep the account's Last Used column worth reading:
it says which product reached the Space, and revoking one cannot take the other down. Read is the
permission level, not fine-grained: fine-grained needs the Space scoped by hand and fails with the
same 401 as a Space-side `ASR_TOKEN` check, and one symptom with two causes is a bad thing to own
in the week before a deadline. The Space's address is not a credential and never needed recovering:
Kintale publishes it in its own `/api/health`.

## 18. Voice Transcribe takes a `request` part and an `audio` part (Oct 27)

The adapter was written to the OpenAI-style multipart form — `model`, `language`, `file` — because
that is what a hosted speech-to-text endpoint usually takes. The first live call refused it with
400, `Both a 'request' and an 'audio' part are required`, so the real shape is two parts: `request`,
a JSON document carrying the model and the language, and `audio`, the clip. The adapter now sends
that and a test asserts the part names, because the failure it replaces was invisible until a live
call: every unit test passed against the wrong form. This is decision 7 happening a second time, and
the same rule applies — an integration is written from the other side's code or a live call, never
from what the shape usually is.

## 19. A listener is named only once it has spoken (Oct 27)

The turn named Listener A before either listener had produced anything, and when both first-listener
paths failed it still reported `firstListener: "Listener A (Omnilingual ASR)"` while quietly filling
`transcript` from the second listener. The screen compounded it: the transcript block was labelled
`Heard (Omnilingual ASR, …)` in fixed text, and the second listener's block was hidden whenever the
two matched, so a cold Space showed one transcript credited to a listener that never ran. The
response now carries `null` until a listener has really transcribed, `transcript` holds the first
listener's words or none, and the label on the screen is read from the turn instead of assumed.
Attribution is not decoration here: the whole product rests on two listeners being told apart, and a
reading credited to the wrong one is worse than a reading marked missing.

## 20. Not knowing the language is not the same as the language being right (Oct 27)

A live turn in an Amharic session came back with a transcript holding no Ethiopic at all and raised
no flag. The heuristic had done what it was written to do: it answers which language a transcript
is, and it answered that it could not tell, so the mismatch rule — which refuses to flag an
unnamed language — stayed quiet. But the question a session asks is narrower than the one the
heuristic answers. Not "which language is this" but "is this not the one we are set to", and for
Amharic the script settles it: Amharic is written in Ethiopic, so a transcript with none of it is
not Amharic whatever it turns out to be. The flag now says that and only that, naming no language
it cannot identify, and it fires only when neither listener nor heuristic named one.

It is deliberately one-directional. Afaan Oromo is written in Latin, so Latin text is no evidence
against an Oromo session, and Ethiopic in an Oromo session is already caught by the heuristic
recognising Amharic. It also needs twelve letters before it will speak: a patient who answers
"25 mg" has said nothing in any script, and a red flag there is the crying wolf of decision 14.

## 21. A printed prohibition is a direction, not housekeeping (Oct 27)

The first live label read came back exactly right — drug, strength, directions, and the whole
printed text — and the text handed on for comparison dropped one line of it: "Do not take with
milk." The reader had put the warning in `text` and the directions sentence in `instructions`,
which is a fair reading of a prompt that asked for "the directions sentence", and the composer
preferred the named fields over everything legible. That preference is right in general: a label
also carries capsule counts and lot numbers, and comparing those against what a patient said
raises conflicts nobody needed. A prohibition is the exception, and it is the exception that
matters most, so it is carried through even when the reader files it elsewhere. It cannot create a
false conflict: the label comparison weighs dose, frequency and drug, and never a negation.

The prompt was asked to stop inviting the split — every direction, including anything the patient
must not do. Both halves were changed, because the prompt is the cause and the composer is the
guard, and a guard that only works when the cause behaves is not a guard.

What counts as a negation now lives in one place. Two lists would drift, and the half that drifted
would be the half that quietly stopped flagging.

## 22. An empty answer says which keys it saw (Oct 27)

SAM returned no boxes on a photo with one obvious label, in 1.4 seconds, with no error. A tolerant
parser cannot tell you whether a model returned boxes under a key it does not recognise or returned
no boxes at all, and those are a bug and an answer. The empty result now carries the shape of what
came back: the keys and the type of each leaf, never a value, so it is safe to return and safe to
log while someone is holding a real prescription.

## 23. The fallback listener cannot hear what the app records (Oct 27)

Three live 400s walked the Voice Transcribe adapter from the shape it was guessed into toward the
shape it needed, and dev.meta.ai's reference settles the rest: two parts, `request` and `audio`;
the request part carrying `mode`, `model`, `audioEncoding` and `languageBias`; PUSH_TO_TALK for one
speaker saying one thing; the language written out in full, not as a code. The adapter now sends
that.

It also surfaced something no amount of fixing the adapter will solve. The endpoint takes a
RIFF/WAVE container holding mono 16-bit PCM at 16 or 24 kHz, and nothing else. MediaRecorder gives
Opus in WebM, which is what both recorders in this repository produce. So the fallback that exists
to save a turn when the Space is asleep cannot accept a single clip the app records — and the Space
sleeps inside half an hour, which is to say it is asleep nearly every time anyone arrives.

Until that is closed, the adapter refuses a non-WAV clip itself and says why, rather than sending
it to be refused with a number. A turn that cannot be heard should say which listener could not
hear it and for what reason; a 400 from somebody else's API is not that.

