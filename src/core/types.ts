export type Language = "am" | "om";
/** What a turn can be spoken in: the patient's language, or English when the provider speaks. */
export type SpeechLanguage = Language | "en";
/** Who spoke the turn. The interpreter renders a patient turn into English and a provider turn into the patient's language; Teach-Back checks both. */
export type Role = "patient" | "provider";

export type FactType = "dose" | "frequency" | "drug" | "negation" | "body_part" | "date" | "duration" | "number" | "symptom";

/** A critical fact pulled from an English rendering, with the words it came from. */
export type Fact = {
  type: FactType;
  /** Canonical value used for comparison, e.g. "2 tablet", "500 mg", "3/day", "not allergic", "left knee", "2026-10-13", "4 children", "1200 USD", "year 2019". */
  value: string;
  /** The exact words in the source text. */
  source: string;
  /** Character offsets into the source text, for highlighting. */
  start: number;
  end: number;
  /** Extra detail a reviewer should see, e.g. the Ethiopian date as spoken, or an ambiguity. */
  note?: string;
};

export type FlagSeverity = "crit" | "warn";

export type FlagKind =
  | "listener_disagreement"   // the two listeners heard different values for the same kind of fact
  | "single_listener"         // only one listener heard this fact
  | "language_mismatch"       // the patient is speaking a different language from the session
  | "label_conflict"          // the medication label contradicts what was spoken
  | "invalid_date"            // a spoken date does not exist in the Ethiopian calendar
  | "ambiguous_calendar"      // the month name is used for both calendars (Afaan Oromo)
  | "unverified"              // only one listener heard the turn, so nothing was cross-checked
  | "interpreter_changed"     // the interpreter's rendering carries a different value from what the speaker said
  | "interpreter_dropped"     // a fact the speaker said is missing from the interpreter's rendering
  | "interpreter_added";      // the interpreter's rendering carries a fact the speaker never said

export type Flag = {
  kind: FlagKind;
  severity: FlagSeverity;
  type?: FactType;
  message: string;
  /** What each side said, where that applies. */
  a?: string;
  b?: string;
  /** Index into the primary fact list, when the flag is about one fact. */
  factIndex?: number;
};

export type Listener = {
  name: string;
  /** The English rendering produced by this listener. */
  english: string;
  facts: Fact[];
};

export type TurnAnalysis = {
  primary: Listener;
  secondary?: Listener;
  flags: Flag[];
};
