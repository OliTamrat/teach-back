/**
 * Flags. Two listeners heard the same audio; where their critical facts differ, a human must
 * look. Nothing here decides who is right. It only decides what a reviewer must confirm.
 */
import type { Fact, FactType, Flag, Language, Listener, TurnAnalysis } from "./types";
import { wrongScriptForSession } from "./language";

const LABELS: Record<FactType, string> = {
  dose: "dose", frequency: "frequency", drug: "drug name", negation: "negation",
  body_part: "body part or side", date: "date", duration: "duration", number: "number or amount",
};

export function compareListeners(primary: Listener, secondary?: Listener): Flag[] {
  const flags: Flag[] = [];
  primary.facts.forEach((f, i) => {
    if (f.type === "date" && f.value === "invalid") {
      flags.push({ kind: "invalid_date", severity: "crit", type: "date", factIndex: i, a: f.source, message: `"${f.source}" is not a date that exists. Ask the patient to repeat it.` });
    }
    if (f.type === "date" && f.note && /both calendars/.test(f.note)) {
      flags.push({ kind: "ambiguous_calendar", severity: "warn", type: "date", factIndex: i, a: f.source, message: `"${f.source}": this month name is used for both the Ethiopian and Gregorian calendars. Confirm which one.` });
    }
  });
  if (!secondary) {
    // One listener is a reading, not a check. The turn must say so, and a person must own it,
    // or a single listener's mistake goes through green.
    if (primary.facts.length) flags.push({ kind: "unverified", severity: "warn", message: `Only one listener heard this turn (${primary.name}). Nothing was cross-checked. Confirm each fact with the patient before anything is written down.` });
    return flags;
  }

  for (const type of Object.keys(LABELS) as FactType[]) {
    const a = primary.facts.filter(f => f.type === type);
    const b = secondary.facts.filter(f => f.type === type);
    const av = a.map(f => norm(f.value)), bv = b.map(f => norm(f.value));
    a.forEach((f, idx) => {
      const i = primary.facts.indexOf(f);
      if (bv.includes(av[idx])) return;
      // A disagreement needs a value on each side the other lacks. If the other listener simply
      // phrased this one differently and missed it, only one listener heard it.
      const other = b.find(g => !av.includes(norm(g.value)));
      if (other) {
        flags.push({ kind: "listener_disagreement", severity: "crit", type, factIndex: i, a: f.source, b: other.source,
          message: `The two listeners disagree on a ${LABELS[type]}: "${f.source}" versus "${other.source}". Confirm with the patient before anything is written down.` });
      } else {
        // A negation heard by one listener only is as dangerous as a disagreement: the other may have dropped the "not".
        const sev = type === "negation" ? "crit" : "warn";
        const tail = type === "negation" ? " The other listener may have dropped the \"not\". Confirm with the patient." : "";
        flags.push({ kind: "single_listener", severity: sev, type, factIndex: i, a: f.source, message: `Only ${primary.name} heard a ${LABELS[type]}: "${f.source}". ${secondary.name} heard none.${tail}` });
      }
    });
    b.forEach((g, idx) => {
      if (av.includes(bv[idx])) return;
      if (a.some(f => !bv.includes(norm(f.value)))) return; // already reported as a disagreement above
      const sev = type === "negation" ? "crit" : "warn";
      const tail = type === "negation" ? ` ${primary.name} may have dropped the "not". Confirm with the patient.` : "";
      flags.push({ kind: "single_listener", severity: sev, type, b: g.source, message: `Only ${secondary.name} heard a ${LABELS[type]}: "${g.source}". ${primary.name} heard none.${tail}` });
    });
  }
  return dedupe(flags);
}

/** A label photo was read; its dose, frequency and drug must not contradict what was spoken. */
/**
 * A dose is either a count ("2 tablet", "2 puff") or an amount ("500 mg", "5 ml"). The two are
 * compared only with their own kind: a patient saying "two tablets of 500 mg" against a label
 * reading "500 mg, take one tablet" conflicts on the count, not on the strength.
 */
// Canonical unit names as facts.ts writes them. Spoonfuls are amounts (they measure a volume, like ml); units of insulin are an amount too.
const COUNT_UNITS = new Set(["tablet", "puff", "drop", "injection"]);
function doseKind(value: string): "count" | "amount" { const u = value.split(" ")[1] || ""; return COUNT_UNITS.has(u) ? "count" : "amount"; }
/** Spoonfuls in millilitres (metric teaspoon 5 ml, tablespoon 15 ml), so "one teaspoon" and "5 ml" agree. */
function normDose(value: string): string {
  const [n, u] = value.split(" ");
  const x = Number(n);
  if (!Number.isFinite(x)) return norm(value);
  if (u === "tsp") return `${+(x * 5).toFixed(2)} ml`;
  if (u === "tbsp") return `${+(x * 15).toFixed(2)} ml`;
  if (u === "g") return `${+(x * 1000).toFixed(2)} mg`;
  return norm(value);
}
const normValue = (type: FactType, v: string) => type === "dose" ? normDose(v) : norm(v);

export function compareWithLabel(spoken: Fact[], label: Fact[]): Flag[] {
  const flags: Flag[] = [];
  for (const type of ["dose", "frequency", "drug"] as FactType[]) {
    const s = spoken.filter(f => f.type === type), l = label.filter(f => f.type === type);
    if (!s.length || !l.length) continue;
    for (const f of s) {
      // Compare like with like: for doses, only the label values of the same kind count.
      const peers = type === "dose" ? l.filter(g => doseKind(g.value) === doseKind(f.value)) : l;
      if (!peers.length) continue;
      if (peers.some(g => normValue(type, g.value) === normValue(type, f.value))) continue;
      const other = peers.find(g => !s.some(h => normValue(type, h.value) === normValue(type, g.value))) ?? peers[0];
      flags.push({ kind: "label_conflict", severity: "crit", type, a: f.source, b: other.source,
        message: `The patient said "${f.source}" but the label reads "${other.source}". Check the ${LABELS[type]} before the patient leaves.` });
    }
  }
  return flags;
}

/**
 * The mismatch nobody could name. When neither listener nor heuristic identified a language, a
 * session set to Amharic whose transcript holds no Ethiopic is still wrong, and silence there is
 * the worst answer: the reviewer goes on believing the session language was right. Says what is
 * known — that it is not Amharic — and does not guess what it is instead.
 */
export function scriptMismatch(expected: Language, text: string): Flag | null {
  if (!wrongScriptForSession(expected, text)) return null;
  return {
    kind: "language_mismatch", severity: "crit",
    message: "This session is set to Amharic, but nothing in what was heard is written in Ethiopic script. Check which language the patient is speaking before going on.",
  };
}

export function languageMismatch(expected: Language, detected: Language | null, confidence = 1): Flag | null {
  if (!detected || detected === expected || confidence < 0.6) return null;
  const name = (l: Language) => (l === "am" ? "Amharic" : "Afaan Oromo");
  return { kind: "language_mismatch", severity: "crit", message: `The patient is speaking ${name(detected)}, but this session is set to ${name(expected)}. Stop and get the right interpreter.` };
}

export function analyzeTurn(primary: Listener, secondary?: Listener, extra: Flag[] = []): TurnAnalysis {
  const flags = [...extra, ...compareListeners(primary, secondary)];
  flags.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === "crit" ? -1 : 1));
  return { primary, secondary, flags };
}

function norm(v: string): string { return v.toLowerCase().replace(/\s+/g, " ").trim(); }
function dedupe(flags: Flag[]): Flag[] {
  const seen = new Set<string>();
  return flags.filter(f => { const k = f.kind + "|" + f.type + "|" + f.a + "|" + f.b; if (seen.has(k)) return false; seen.add(k); return true; });
}
