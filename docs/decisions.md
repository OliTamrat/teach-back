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
