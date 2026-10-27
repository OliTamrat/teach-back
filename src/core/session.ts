/**
 * What happens after the flags are decided. A turn is final only when a person has confirmed or
 * corrected every flag; then its English line is written with the corrections applied, and it
 * joins the session log the interpreter takes away. Pure: the screen stores and displays, this
 * file decides what a final line says.
 */
import type { Fact, Flag, Language } from "./types";

export type Decision = { state: "open" | "confirmed" | "corrected"; correction?: string };

export type TurnRecord = {
  id: string;
  /** ISO timestamp of when the turn was finalised. */
  at: string;
  language: Language;
  /** The day the words were spoken, ISO date; Ethiopian dates were resolved against it. */
  reference: string;
  /** What the first listener heard, in its own script, when the turn came from audio. */
  transcript?: string;
  /** The primary English rendering as the listeners produced it. */
  english: string;
  /** The English line after the reviewer's corrections. */
  summary: string;
  facts: Fact[];
  flags: Flag[];
  decisions: Decision[];
};

export function allDecided(flags: Flag[], decisions: Record<number, Decision> | Decision[]): boolean {
  return flags.every((_, i) => (decisions[i]?.state ?? "open") !== "open");
}

/**
 * The final English line: the rendering with each corrected fact replaced by what the reviewer
 * wrote. A correction to a flag that is not about one fact (a language mismatch, say) cannot be
 * placed in the text, so it is appended as a note. Replacements run from the end of the text so
 * earlier offsets stay valid.
 */
export function finalSummary(english: string, facts: Fact[], flags: Flag[], decisions: Record<number, Decision> | Decision[]): string {
  const byFact = new Map<number, string>();
  const notes: string[] = [];
  flags.forEach((f, i) => {
    const d = decisions[i];
    if (!d || d.state !== "corrected" || !d.correction) return;
    if (f.factIndex !== undefined && facts[f.factIndex]) byFact.set(f.factIndex, d.correction);
    else notes.push(d.correction);
  });
  // Spans can nest: a negation ("not allergic to penicillin") contains the drug inside it. A
  // correction to the outer span replaces the whole of it, so any correction to a span inside it
  // cannot be placed in the text and is kept as a note instead of being silently overwritten.
  const corrected = [...byFact.entries()].map(([idx, correction]) => ({ idx, correction, f: facts[idx] }));
  const placed = corrected.filter(c => !corrected.some(o => o.idx !== c.idx && o.f.start <= c.f.start && o.f.end >= c.f.end && (o.f.end - o.f.start) > (c.f.end - c.f.start)));
  for (const c of corrected) if (!placed.includes(c)) notes.push(`${c.f.type.replace("_", " ")} "${c.f.source}" corrected to "${c.correction}"`);
  let out = english;
  placed.sort((x, y) => y.f.start - x.f.start).forEach(({ f, correction }) => { out = out.slice(0, f.start) + correction + out.slice(f.end); });
  if (notes.length) out += ` (Reviewer: ${notes.join("; ")})`;
  return out;
}

export function makeTurn(input: Omit<TurnRecord, "id" | "at" | "summary"> & { at?: Date }): TurnRecord {
  const at = input.at ?? new Date();
  const { at: _drop, ...rest } = input;
  void _drop;
  return {
    ...rest,
    id: `${at.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: at.toISOString(),
    summary: finalSummary(input.english, input.facts, input.flags, input.decisions),
  };
}

const LANG: Record<Language, string> = { am: "Amharic", om: "Afaan Oromo" };

/** The notes an interpreter takes away: one numbered line per turn, with what was corrected. */
export function sessionNotes(turns: TurnRecord[], now = new Date()): string {
  const lines: string[] = [
    "Teach-Back session notes",
    `Exported ${now.toISOString().slice(0, 16).replace("T", " ")} UTC. ${turns.length} turn${turns.length === 1 ? "" : "s"}.`,
    "Every flag below was confirmed or corrected by a person. This is not medical advice and does not replace a qualified interpreter.",
    "",
  ];
  turns.forEach((t, n) => {
    const time = t.at.slice(11, 16);
    lines.push(`${n + 1}. [${time}] ${LANG[t.language]}: ${t.summary}`);
    t.flags.forEach((f, i) => {
      const d = t.decisions[i];
      if (!d) return;
      const what = f.type ? `${f.type.replace("_", " ")}${f.a ? ` "${f.a}"` : ""}` : f.kind.replace("_", " ");
      if (d.state === "corrected") lines.push(`   corrected: ${what} -> "${d.correction}"`);
      else if (d.state === "confirmed") lines.push(`   confirmed: ${what}`);
    });
  });
  return lines.join("\n");
}
