/**
 * Ethiopian calendar <-> Gregorian, in code, never by a model.
 *
 * The Ethiopian year has twelve months of 30 days and a thirteenth, Pagume, of 5 days (6 in a
 * leap year). Ethiopian year Y is a leap year when Y mod 4 === 3. Meskerem 1 falls on
 * 11 September, or 12 September when the Ethiopian year that is ending was a leap year (which
 * is the year before a Gregorian leap year in this era). Everything below derives from that,
 * via the Julian Day Number, so a wrong month length or an invalid Pagume 6 cannot slip through.
 */

export const MONTHS = [
  "Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit", "Megabit",
  "Miazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume",
] as const;

/** Spellings people actually use, in Latin, Amharic and Afaan Oromo. Lower-cased keys. */
export const MONTH_ALIASES: Record<string, number> = {
  meskerem: 1, meskeram: 1, "መስከረም": 1, fulbaana: 1, fulbana: 1,
  tikimt: 2, tikemt: 2, teqemt: 2, "ጥቅምት": 2, onkoloolessa: 2, onkololessa: 2, onkololeessa: 2,
  hidar: 3, hedar: 3, "ኅዳር": 3, "ህዳር": 3, sadaasa: 3, sadasa: 3,
  tahsas: 4, tahisas: 4, tahesas: 4, "ታኅሣሥ": 4, "ታህሳስ": 4, muddee: 4, mudde: 4,
  tir: 5, ter: 5, "ጥር": 5, amajjii: 5, amajji: 5,
  yekatit: 6, yakatit: 6, "የካቲት": 6, guraandhala: 6, gurandhala: 6,
  megabit: 7, maggabit: 7, "መጋቢት": 7, bitootessa: 7, bitotessa: 7,
  miazia: 8, miyazya: 8, miyazia: 8, "ሚያዝያ": 8, elba: 8, ebla: 8,
  ginbot: 9, genbot: 9, "ግንቦት": 9, caamsaa: 9, camsa: 9,
  sene: 10, "ሰኔ": 10, waxabajjii: 10, waxabajji: 10,
  hamle: 11, "ሐምሌ": 11, "ሃምሌ": 11, adooleessa: 11, adoolessa: 11, adolessa: 11,
  nehase: 12, nehasse: 12, "ነሐሴ": 12, "ነሃሴ": 12, hagayya: 12, hagaya: 12,
  pagume: 13, pagumen: 13, "ጳጉሜ": 13, "ጳጉሜን": 13, qaammee: 13, qaamme: 13,
};

/** Month names Afaan Oromo uses for the Ethiopian months; the same names serve the Gregorian months too. */
export const OROMO_MONTHS = new Set(["fulbaana", "fulbana", "onkoloolessa", "onkololessa", "onkololeessa", "sadaasa", "sadasa", "muddee", "mudde", "amajjii", "amajji", "guraandhala", "gurandhala", "bitootessa", "bitotessa", "elba", "ebla", "caamsaa", "camsa", "waxabajjii", "waxabajji", "adooleessa", "adoolessa", "adolessa", "hagayya", "hagaya", "qaammee", "qaamme"]);

export type EthiopianDate = { year: number; month: number; day: number };
export type GregorianDate = { year: number; month: number; day: number };

/** Beyene & Kudlek epoch: JDN = EPOCH + 365*year + floor(year/4) + 30*month + day - 31. */
const ETHIOPIAN_EPOCH = 1723856;

export function isEthiopianLeapYear(year: number): boolean {
  return ((year % 4) + 4) % 4 === 3;
}

export function monthLength(year: number, month: number): number {
  if (month < 1 || month > 13) return 0;
  if (month < 13) return 30;
  return isEthiopianLeapYear(year) ? 6 : 5;
}

export function isValidEthiopian(d: EthiopianDate): boolean {
  return Number.isInteger(d.year) && Number.isInteger(d.month) && Number.isInteger(d.day) &&
    d.month >= 1 && d.month <= 13 && d.day >= 1 && d.day <= monthLength(d.year, d.month);
}

export function ethiopianToJdn(d: EthiopianDate): number {
  return ETHIOPIAN_EPOCH + 365 * d.year + Math.floor(d.year / 4) + 30 * d.month + d.day - 31;
}

export function jdnToEthiopian(jdn: number): EthiopianDate {
  const r = ((jdn - ETHIOPIAN_EPOCH) % 1461 + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - ETHIOPIAN_EPOCH) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day };
}

export function gregorianToJdn(d: GregorianDate): number {
  const a = Math.floor((14 - d.month) / 12);
  const y = d.year + 4800 - a;
  const m = d.month + 12 * a - 3;
  return d.day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function jdnToGregorian(jdn: number): GregorianDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor(146097 * b / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

/** Returns null for a date that does not exist (e.g. Pagume 6 in a non-leap year). */
export function toGregorian(d: EthiopianDate): GregorianDate | null {
  if (!isValidEthiopian(d)) return null;
  return jdnToGregorian(ethiopianToJdn(d));
}

export function toEthiopian(g: GregorianDate): EthiopianDate {
  return jdnToEthiopian(gregorianToJdn(g));
}

/**
 * A spoken date often has no year ("the fever started on Tikimt 3"). Resolve it against a
 * reference day: the most recent such date on or before the reference, or the next one when
 * `future` is set (appointments). The Ethiopian year is chosen, not guessed by a model.
 */
export function resolveYearless(month: number, day: number, reference: GregorianDate, future = false): EthiopianDate | null {
  const ref = toEthiopian(reference);
  const candidates = [ref.year - 1, ref.year, ref.year + 1]
    .map(year => ({ year, month, day }))
    .filter(isValidEthiopian);
  const refJdn = gregorianToJdn(reference);
  const ordered = candidates
    .map(d => ({ d, jdn: ethiopianToJdn(d) }))
    .sort((a, b) => a.jdn - b.jdn);
  if (future) {
    const next = ordered.find(x => x.jdn >= refJdn);
    return next ? next.d : null;
  }
  const past = [...ordered].reverse().find(x => x.jdn <= refJdn);
  return past ? past.d : null;
}

export function formatGregorian(g: GregorianDate): string {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[g.month - 1]} ${g.day}, ${g.year}`;
}

export function formatEthiopian(d: EthiopianDate): string {
  return `${MONTHS[d.month - 1]} ${d.day}, ${d.year}`;
}
