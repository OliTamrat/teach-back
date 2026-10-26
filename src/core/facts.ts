/**
 * Critical-fact extraction from an English rendering. Deterministic and offline: the point is
 * that a model may render the sentence, but code decides what in it would hurt someone if
 * wrong. Every fact keeps the words it came from, so the reviewer can see the evidence.
 */
import type { Fact, FactType, Language } from "./types";
import { MONTH_ALIASES, formatGregorian, formatEthiopian, resolveYearless, toGregorian, type GregorianDate } from "./calendar";

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000, half: 0.5, once: 1, twice: 2,
};
const NUM = "(\\d+(?:[.,]\\d+)?|half(?: a| an)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred|thousand)";

export function parseNumber(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (/^\d/.test(t)) return parseFloat(t.replace(/,/g, ""));
  if (t.startsWith("half")) return 0.5;
  return t in NUMBER_WORDS ? NUMBER_WORDS[t] : null;
}

const UNITS: Array<[RegExp, string]> = [
  [/^(mg|milligrams?|milligrammes?)$/i, "mg"],
  [/^(mcg|micrograms?|µg)$/i, "mcg"],
  [/^(g|grams?)$/i, "g"],
  [/^(ml|mls|millilitres?|milliliters?|cc)$/i, "ml"],
  [/^(units?|iu)$/i, "unit"],
  [/^(tablets?|tabs?|pills?|capsules?)$/i, "tablet"],
  [/^(puffs?|inhalations?)$/i, "puff"],
  [/^(drops?)$/i, "drop"],
  [/^(teaspoons?|tsp)$/i, "tsp"],
  [/^(tablespoons?|tbsp)$/i, "tbsp"],
  [/^(injections?|shots?)$/i, "injection"],
];
function unitOf(word: string): string | null {
  for (const [re, u] of UNITS) if (re.test(word)) return u;
  return null;
}
const UNIT_RE = "(mg|milligrams?|milligrammes?|mcg|micrograms?|g|grams?|ml|mls|millilitres?|milliliters?|cc|units?|iu|tablets?|tabs?|pills?|capsules?|puffs?|inhalations?|drops?|teaspoons?|tsp|tablespoons?|tbsp)";

export const DRUGS = [
  "metformin", "lisinopril", "amlodipine", "amoxicillin", "omeprazole", "salbutamol", "albuterol",
  "paracetamol", "acetaminophen", "ibuprofen", "aspirin", "warfarin", "insulin", "tramadol", "penicillin",
  "atorvastatin", "losartan", "hydrochlorothiazide", "prednisone", "azithromycin", "ciprofloxacin",
  "doxycycline", "metoprolol", "furosemide", "gabapentin", "sertraline", "levothyroxine", "glibenclamide",
  "artemether", "lumefantrine", "chloroquine", "cotrimoxazole", "iron", "folic acid",
];

const BODY_PARTS = "(knee|eye|ear|leg|arm|hand|foot|feet|shoulder|hip|breast|lung|kidney|ankle|wrist|elbow|thigh|calf|cheek|nostril|side of (?:my|the) (?:stomach|abdomen|chest|head|back|neck)|side|stomach|abdomen|belly|chest|back|neck|head|throat|tooth|teeth|jaw|finger|toe|heel|groin|flank)";

export type ExtractOptions = {
  /** The day the words were spoken, for resolving dates with no year. Defaults to today. */
  reference?: GregorianDate;
  /** Spoken language, which decides whether a month name is ambiguous between calendars. */
  language?: Language;
};

export function extractFacts(text: string, opts: ExtractOptions = {}): Fact[] {
  const facts: Fact[] = [];
  const push = (f: Fact) => { if (!facts.some(x => x.type === f.type && x.start === f.start)) facts.push(f); };
  const lower = text.toLowerCase();

  // --- dose: number + unit ("two tablets of 500 milligrams", "2.5 mg", "20 units", "half a tablet")
  for (const m of text.matchAll(new RegExp(`\\b${NUM}(?:[- ]${UNIT_RE})\\b`, "gi"))) {
    const n = parseNumber(m[1]); const u = unitOf(m[2]);
    if (n === null || !u) continue;
    push({ type: "dose", value: `${fmt(n)} ${u}`, source: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  // "half a tablet" without a number before "tablet"
  for (const m of text.matchAll(/\bhalf (?:a |an )?(tablet|pill|capsule|teaspoon)\b/gi)) {
    push({ type: "dose", value: `0.5 ${unitOf(m[1])}`, source: m[0], start: m.index!, end: m.index! + m[0].length });
  }

  // --- frequency
  const freqPatterns: Array<[RegExp, (m: RegExpMatchArray) => string | null]> = [
    [new RegExp(`\\b${NUM} times? (?:a|per|each|every) (day|week|month|hour)\\b`, "gi"), m => { const n = parseNumber(m[1]); return n === null ? null : `${fmt(n)}/${m[2].toLowerCase()}`; }],
    [/\b(once|twice|three times|four times) (?:a|per|each|every) (day|week|month)\b/gi, m => `${fmt(parseNumber(m[1].split(" ")[0])!)}/${m[2].toLowerCase()}`],
    [new RegExp(`\\bevery ${NUM} (hours?|days?|weeks?)\\b`, "gi"), m => { const n = parseNumber(m[1]); return n === null ? null : `every ${fmt(n)} ${m[2].toLowerCase().replace(/s$/, "")}`; }],
    [/\bevery other day\b/gi, () => "every 2 day"],
    [/\b(?:only )?(?:when|if) (?:the )?(?:pain is bad|needed|necessary|i cannot breathe|i can't breathe|required)\b|\bas needed\b/gi, () => "as needed"],
    [/\bno more than (\w+) (?:a|per) day\b/gi, m => { const n = parseNumber(m[1]); return n === null ? null : `max ${fmt(n)}/day`; }],
    [/\b(?:in the )?morning and (?:in the )?evening\b|\bmorning and night\b/gi, () => "2/day"],
    [/\b(before|after|with) (dinner|breakfast|lunch|meals|food)\b/gi, m => `${m[1].toLowerCase()} ${m[2].toLowerCase()}`],
    [/\b(every|each|at) (evening|night|morning)\b/gi, m => m[2].toLowerCase()],
    [/\bon (sundays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?)\b/gi, m => m[1].toLowerCase().replace(/s$/, "")],
  ];
  for (const [re, val] of freqPatterns) {
    for (const m of text.matchAll(re)) {
      const v = val(m); if (!v) continue;
      push({ type: "frequency", value: v, source: m[0], start: m.index!, end: m.index! + m[0].length });
    }
  }

  // --- duration ("for three weeks", "two days ago", "two hours after")
  for (const m of text.matchAll(new RegExp(`\\b(?:for |lasted |since )?${NUM} (hours?|days?|weeks?|months?|years?)( ago| after| later)?\\b`, "gi"))) {
    const n = parseNumber(m[1]); if (n === null) continue;
    const unit = m[2].toLowerCase().replace(/s$/, "");
    // "every 8 hours" is a frequency, already captured
    const before = text.slice(Math.max(0, m.index! - 8), m.index!);
    if (/every\s$/i.test(before) || /(times|per|each)\s$/i.test(before)) continue; // "every 8 hours", "times a day" are frequencies
    push({ type: "duration", value: `${fmt(n)} ${unit}${m[3] ? m[3].trim() === "ago" ? " ago" : " after" : ""}`, source: m[0].trim(), start: m.index!, end: m.index! + m[0].length });
  }

  // --- drug names
  for (const drug of DRUGS) {
    const re = new RegExp(`\\b${drug.replace(/ /g, "\\s+")}\\b`, "gi");
    for (const m of text.matchAll(re)) push({ type: "drug", value: drug, source: m[0], start: m.index!, end: m.index! + m[0].length });
  }

  // --- negation: the negator plus what it governs (up to the next clause break)
  for (const m of text.matchAll(/\b(not|no|never|cannot|can't|don't|do not|doesn't|does not|didn't|did not|isn't|haven't|have not|stopped|without)\b([^.,;]{0,40})/gi)) {
    const scope = m[2].trim().split(/\s+/).slice(0, 5).join(" ");
    if (/^(more than)/i.test(scope)) continue; // "no more than three" is a frequency cap
    push({ type: "negation", value: `${m[1].toLowerCase()} ${scope}`.trim(), source: (m[1] + m[2]).trim(), start: m.index!, end: m.index! + m[0].length });
  }

  // --- body part with side
  for (const m of text.matchAll(new RegExp(`\\b((?:lower |upper )?(?:left|right)(?: side of (?:my|the))? ${BODY_PARTS}|${BODY_PARTS} on the (?:lower |upper )?(?:left|right)(?: side)?|(?:left|right) side)\\b`, "gi"))) {
    const s = m[0].toLowerCase();
    const side = /left/.test(s) ? "left" : "right";
    let part = s.replace(/\b(lower|upper|left|right|side of (my|the)|on the|side|my|the)\b/g, " ").replace(/\s+/g, " ").trim();
    if (!part) {
      const window = text.slice(Math.max(0, m.index! - 30), m.index!).toLowerCase();
      const prior = [...window.matchAll(new RegExp(BODY_PARTS, "g"))].pop();
      part = prior ? prior[1].replace(/^side of (my|the) /, "") : "side";
    }
    const vert = /lower/.test(s) ? "lower " : /upper/.test(s) ? "upper " : "";
    push({ type: "body_part", value: `${vert}${side} ${part}`.replace(/\s+/g, " ").trim(), source: m[0], start: m.index!, end: m.index! + m[0].length });
  }

  // --- Ethiopian-calendar dates: <month> <day>[, <year>]
  const monthAlt = Object.keys(MONTH_ALIASES).filter(k => /^[a-z]/.test(k)).sort((a, b) => b.length - a.length).join("|");
  for (const m of text.matchAll(new RegExp(`\\b(${monthAlt})\\s+(\\d{1,2})(?:(?:,|\\s+bara|\\s+ቀን)?\\s+(\\d{4}))?(?:\\s*(?:e\\.?c\\.?|ዓ\\.?ም\\.?))?`, "gi"))) {
    const month = MONTH_ALIASES[m[1].toLowerCase()];
    const day = parseInt(m[2], 10);
    const year = m[3] ? parseInt(m[3], 10) : null;
    const reference = opts.reference ?? today();
    const future = /\b(next|appointment|come back|return)\b/i.test(lower.slice(Math.max(0, m.index! - 40), m.index!));
    const eth = year !== null ? { year, month, day } : resolveYearless(month, day, reference, future);
    const greg = eth ? toGregorian(eth) : null;
    const oromoName = /^(fulbaana|fulbana|onkoloolessa|onkololessa|sadaasa|sadasa|muddee|mudde|amajjii|amajji|guraandhala|gurandhala|bitootessa|bitotessa|elba|ebla|caamsaa|camsa|waxabajjii|waxabajji|adooleessa|adoolessa|adolessa|hagayya|hagaya|qaammee|qaamme)$/i.test(m[1]);
    let note = eth && greg ? `${formatEthiopian(eth)} (Ethiopian) = ${formatGregorian(greg)}` : `${m[1]} ${m[2]}${year ? ", " + year : ""} does not exist in the Ethiopian calendar`;
    if (oromoName && opts.language === "om") note += ". Afaan Oromo uses this month name for both calendars: confirm which the patient meant";
    push({
      type: "date",
      value: greg ? isoDate(greg) : "invalid",
      source: m[0].trim(), start: m.index!, end: m.index! + m[0].trim().length, note,
    });
  }

  return facts.sort((a, b) => a.start - b.start);
}

export function factsOfType(facts: Fact[], type: FactType): Fact[] { return facts.filter(f => f.type === type); }

function fmt(n: number): string { return Number.isInteger(n) ? String(n) : String(n); }
function isoDate(g: GregorianDate): string { return `${g.year}-${String(g.month).padStart(2, "0")}-${String(g.day).padStart(2, "0")}`; }
function today(): GregorianDate { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }; }
