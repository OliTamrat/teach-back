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
