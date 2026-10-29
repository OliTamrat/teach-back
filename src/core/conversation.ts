/**
 * Listening mode: the microphone stays open, the audio is cut into turns at pauses, and nobody
 * presses a button to say who is speaking. The rule that makes this work is simple and it is
 * what an interpreted visit is: every change of language is the interpreter rendering the turn
 * before it. Amharic after English is the interpreter telling the patient what the provider
 * said; English after Amharic is the interpreter telling the provider what the patient said.
 * The same language twice is the same speaker going on. Each rendering is checked, fact by
 * fact, against the turn it renders; each patient-language turn is also cross-checked by the two
 * listeners as before. Pure: the screen feeds turns in as they arrive and shows what comes out.
 */
import { compareWithSource } from "./compare";
import type { Fact, Flag, Language, SpeechLanguage } from "./types";

export type ConversationTurn = {
  id: string;
  at: string;
  /** What the turn was spoken in. */
  language: SpeechLanguage;
  /** What the listeners rendered it as, in English (the transcript itself for English). */
  english: string;
  transcript: string;
  facts: Fact[];
  /** Flags from the listeners' own cross-check of this turn. */
  listenerFlags: Flag[];
  /** Who this turn is taken to be, from the alternation rule. */
  role: "patient" | "provider" | "interpreter_to_provider" | "interpreter_to_patient";
  /** The turn or run of turns this one renders, when the language changed: ids joined with "+". */
  rendersId?: string;
  /** Flags from checking this rendering against the turn it renders. */
  interpreterFlags: Flag[];
  /** A role a person set by hand; survives re-placing. */
  forcedRole?: ConversationTurn["role"];
};

export const ROLE_LABEL: Record<ConversationTurn["role"], string> = {
  patient: "Patient", provider: "Provider", interpreter_to_provider: "Interpreter, to the provider", interpreter_to_patient: "Interpreter, to the patient",
};

/**
 * Place a new turn in the conversation: decide its role, and when the language changed, check it
 * against the whole run of same-language turns before it. People pause mid-sentence, so "take two
 * tablets" and "of 500 milligrams" may arrive as two turns; the interpreter renders both, and the
 * check must see both. The run is every consecutive turn on the same side back to the last change.
 */
export function placeTurn(previous: ConversationTurn[] | ConversationTurn | undefined, turn: Omit<ConversationTurn, "role" | "rendersId" | "interpreterFlags">, session: Language): ConversationTurn {
  const history = Array.isArray(previous) ? previous : previous ? [previous] : [];
  const last = history[history.length - 1];
  const isEnglish = turn.language === "en";
  if (!last || sameSide(last.language, turn.language, session)) {
    return { ...turn, role: isEnglish ? "provider" : "patient", interpreterFlags: [] };
  }
  const run = sourceRun(history, session);
  // The turn before was itself a rendering (patient, interpreter, and now the patient again): this is a new source turn, not an interpretation.
  if (!run.length) return { ...turn, role: isEnglish ? "provider" : "patient", interpreterFlags: [] };
  const role = isEnglish ? "interpreter_to_provider" : "interpreter_to_patient";
  const who = role === "interpreter_to_provider" ? "the interpreter, to the provider," : "the interpreter, to the patient,";
  const sourceFacts = run.flatMap(t => t.facts);
  const interpreterFlags = compareWithSource(sourceFacts, turn.facts, who);
  return { ...turn, role, rendersId: run.map(t => t.id).join("+"), interpreterFlags };
}

/**
 * The run at the end of the history that the next rendering renders: consecutive turns by the same
 * speaker. A rendering is never itself a source (the interpreter's English of the patient is not
 * what the provider said), and a change of speaker on the same side ends the run.
 */
export function sourceRun(history: ConversationTurn[], session: Language): ConversationTurn[] {
  const out: ConversationTurn[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    if (t.role.startsWith("interpreter")) break;
    if (out.length && (!sameSide(out[0].language, t.language, session) || out[0].role !== t.role)) break;
    out.unshift(t);
  }
  return out;
}

/**
 * A person relabels a turn's role, or its language, when the rule got it wrong (a provider who
 * speaks some Amharic; a relative who interprets and also answers). The whole conversation is
 * placed again from the start, because every later pairing depends on it.
 */
export function relabel(turns: ConversationTurn[], id: string, change: { language?: SpeechLanguage; role?: ConversationTurn["role"] }, session: Language): ConversationTurn[] {
  const out: ConversationTurn[] = [];
  for (const t of turns) {
    const base = { id: t.id, at: t.at, language: t.language, english: t.english, transcript: t.transcript, facts: t.facts, listenerFlags: t.listenerFlags, forcedRole: t.forcedRole };
    if (t.id === id) { if (change.language) base.language = change.language; base.forcedRole = change.role ?? base.forcedRole; }
    const placed = placeTurn(out, base, session);
    out.push(base.forcedRole ? applyForcedRole(placed, base.forcedRole, out, session) : placed);
  }
  return out;
}

function applyForcedRole(placed: ConversationTurn, role: ConversationTurn["role"], history: ConversationTurn[], session: Language): ConversationTurn {
  if (role === "patient" || role === "provider") return { ...placed, role, rendersId: undefined, interpreterFlags: [], forcedRole: role };
  // Forced to be the interpreter: render the run of the other side before this turn, whatever the language rule said.
  const other = [...history].reverse().find(t => !sameSide(t.language, placed.language, session));
  if (!other) return { ...placed, role, rendersId: undefined, interpreterFlags: [], forcedRole: role };
  const run = sourceRun(history.slice(0, history.indexOf(other) + 1), session);
  const who = role === "interpreter_to_provider" ? "the interpreter, to the provider," : "the interpreter, to the patient,";
  return { ...placed, role, rendersId: run.map(t => t.id).join("+"), interpreterFlags: compareWithSource(run.flatMap(t => t.facts), placed.facts, who), forcedRole: role };
}

function sameSide(a: SpeechLanguage, b: SpeechLanguage, session: Language): boolean {
  const side = (l: SpeechLanguage) => (l === "en" ? "en" : l === session ? "patient" : "other");
  return side(a) === side(b);
}

/** Every flag a reviewer must decide on a turn, interpreter flags first because they are about this rendering. */
export function turnFlags(t: ConversationTurn): Flag[] {
  return [...t.interpreterFlags, ...t.listenerFlags].sort((x, y) => (x.severity === y.severity ? 0 : x.severity === "crit" ? -1 : 1));
}

/** The conversation as one English record, each turn labelled, for the session notes. */
export function conversationText(turns: ConversationTurn[]): string {
  return turns.map((t, i) => `${i + 1}. ${ROLE_LABEL[t.role]}: ${t.english}`).join("\n");
}
