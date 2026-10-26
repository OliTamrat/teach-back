/**
 * The teach-back question in the patient's language, for the interpreter to read aloud.
 * These are drafts written for native review and are marked as such until a reviewer signs them
 * off in REVIEWED below. They are templates, never model output: nothing a model produced is ever
 * put in front of a patient. The polite second person is used throughout (Amharic እርስዎ, Afaan
 * Oromo isin), because the patient is more often than not older than the interpreter.
 */
import type { Fact, FactType, Language } from "./types";

export const REVIEWED: Record<Language, { reviewed: boolean; by?: string; on?: string }> = {
  am: { reviewed: false },
  om: { reviewed: false },
};

const AM: Record<FactType, (f: Fact) => string> = {
  dose: () => "በእያንዳንዱ ጊዜ ምን ያህል ይወስዳሉ? እባክዎ በራስዎ ቃላት ይንገሩኝ።",
  frequency: () => "በቀን ስንት ጊዜ ይወስዱታል፣ መቼ መቼ?",
  drug: f => `ይህ የትኛው መድኃኒት ነው? እባክዎ ስሙን ይድገሙልኝ፤ ${f.source} ነው?`,
  negation: f => `በትክክል መስማቴን ማረጋገጥ እፈልጋለሁ። "${f.source}" ብለዋል። ትክክል ነው?`,
  date: f => `"${f.source}" ሲሉ የትኛውን ቀን ማለትዎ ነው? በየትኛው ወርና ዓመት፣ በሚጠቀሙት አቆጣጠር?`,
  body_part: () => "እባክዎ የት እንደሆነ ያሳዩኝ።",
  duration: f => `ለምን ያህል ጊዜ? "${f.source}" ብለዋል።`,
};

const OM: Record<FactType, (f: Fact) => string> = {
  dose: () => "Yeroo tokkoon hammam fudhattu? Maaloo jecha keessaniin natti himaa.",
  frequency: () => "Guyyaatti si'a meeqa fudhattu, yoomii fi yoom?",
  drug: f => `Qorichi kun kami? Maaloo maqaa isaa naaf irra deebi'aa; ${f.source} dhaa?`,
  negation: f => `Sirriitti dhaga'uu koo mirkaneeffachuun barbaada. "${f.source}" jettan. Sirriidhaa?`,
  date: f => `"${f.source}" jechuun guyyaa kam jechuu keessan? Ji'a fi bara kam, lakkoofsa yeroo isin fayyadamtaniin?`,
  body_part: () => "Maaloo eessa akka ta'e natti agarsiisaa.",
  duration: f => `Hammam dheeratee? "${f.source}" jettan.`,
};

const TEMPLATES: Record<Language, Record<FactType, (f: Fact) => string>> = { am: AM, om: OM };

/** The question in the patient's language, with whether a native speaker has reviewed the wording. */
export function localizedQuestion(fact: Fact, language: Language): { text: string; reviewed: boolean } {
  return { text: TEMPLATES[language][fact.type](fact), reviewed: REVIEWED[language].reviewed };
}
