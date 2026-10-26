/**
 * Flags. Two listeners heard the same audio; where their critical facts differ, a human must
 * look. Nothing here decides who is right. It only decides what a reviewer must confirm.
 */
import type { Fact, FactType, Flag, Language, Listener, TurnAnalysis } from "./types";

const LABELS: Record<FactType, string> = {
  dose: "dose", frequency: "frequency", drug: "drug name", negation: "negation",
  body_part: "body part or side", date: "date", duration: "duration",
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
  if (!secondary) return flags;

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
export function compareWithLabel(spoken: Fact[], label: Fact[]): Flag[] {
  const flags: Flag[] = [];
  for (const type of ["dose", "frequency", "drug"] as FactType[]) {
    const s = spoken.filter(f => f.type === type), l = label.filter(f => f.type === type);
    if (!s.length || !l.length) continue;
    const lv = l.map(f => norm(f.value));
    for (const f of s) {
      if (lv.includes(norm(f.value))) continue;
      flags.push({ kind: "label_conflict", severity: "crit", type, a: f.source, b: l[0].source,
        message: `The patient said "${f.source}" but the label reads "${l[0].source}". Check the ${LABELS[type]} before the patient leaves.` });
    }
  }
  return flags;
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
