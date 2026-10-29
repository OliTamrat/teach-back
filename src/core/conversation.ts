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
  /** The turn this one renders, when the language changed. */
  rendersId?: string;
  /** Flags from checking this rendering against the turn it renders. */
  interpreterFlags: Flag[];
};

export const ROLE_LABEL: Record<ConversationTurn["role"], string> = {
  patient: "Patient", provider: "Provider", interpreter_to_provider: "Interpreter, to the provider", interpreter_to_patient: "Interpreter, to the patient",
};

/** Place a new turn in the conversation: decide its role, and check it against the turn before it when the language changed. */
export function placeTurn(previous: ConversationTurn | undefined, turn: Omit<ConversationTurn, "role" | "rendersId" | "interpreterFlags">, session: Language): ConversationTurn {
  const isEnglish = turn.language === "en";
  if (!previous || sameSide(previous.language, turn.language, session)) {
    return { ...turn, role: isEnglish ? "provider" : "patient", interpreterFlags: [] };
  }
  // The language changed: this turn renders the previous one.
  const role = isEnglish ? "interpreter_to_provider" : "interpreter_to_patient";
  const who = role === "interpreter_to_provider" ? "the interpreter, to the provider," : "the interpreter, to the patient,";
  const interpreterFlags = compareWithSource(previous.facts, turn.facts, who);
  return { ...turn, role, rendersId: previous.id, interpreterFlags };
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
