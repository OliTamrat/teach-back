import { describe, expect, it } from "vitest";
import { extractFacts, factsOfType } from "./facts";

const ref = { year: 2026, month: 10, day: 31 }; // recording day
const values = (text: string, type: Parameters<typeof factsOfType>[1], language?: "am" | "om") =>
  factsOfType(extractFacts(text, { reference: ref, language }), type).map(f => f.value);

describe("doses", () => {
  it("number plus unit, digits or words", () => {
    expect(values("The doctor told me to take two tablets of 500 milligrams.", "dose")).toEqual(["2 tablet", "500 mg"]);
    expect(values("I give my son 5 milliliters of the syrup.", "dose")).toEqual(["5 ml"]);
    expect(values("I inject 20 units of insulin before dinner.", "dose")).toEqual(["20 unit"]);
    expect(values("The nurse said 2.5 milligrams of warfarin every evening.", "dose")).toEqual(["2.5 mg"]);
    expect(values("I take 1,000 milligrams of metformin with breakfast.", "dose")).toEqual(["1000 mg"]);
    expect(values("I use two puffs of the inhaler when I cannot breathe.", "dose")).toEqual(["2 puff"]);
    expect(values("She gave me 15 drops of the medicine in water.", "dose")).toEqual(["15 drop"]);
  });
  it("half a tablet", () => {
    expect(values("Half a tablet in the morning, not a whole one.", "dose")).toEqual(["0.5 tablet"]);
  });
  it("keeps the source words and offsets", () => {
    const f = extractFacts("I was told to take one 10-milligram tablet of amlodipine.").find(x => x.value === "10 mg")!;
    expect(f.type).toBe("dose");
    expect(f.source).toBe("10-milligram");
    expect("I was told to take one 10-milligram tablet of amlodipine.".slice(f.start, f.end)).toBe(f.source);
  });
});

describe("frequencies", () => {
  it.each([
    ["I take it three times a day after meals.", ["3/day", "after meals"]],
    ["Only once a week, on Sundays.", ["1/week", "sunday"]],
    ["Every eight hours, even at night.", ["every 8 hour", "night"]],
    ["Twice a day, morning and evening.", ["2/day", "2/day"]],
    ["Four times a day for seven days.", ["4/day"]],
    ["Every other day, not every day.", ["every 2 day"]],
    ["Only when the pain is bad, no more than three a day.", ["as needed", "max 3/day"]],
  ])("%s", (text, expected) => {
    expect(values(text, "frequency")).toEqual(expected);
  });
  it("a day count after a frequency is a duration", () => {
    expect(values("Four times a day for seven days.", "duration")).toEqual(["7 day"]);
  });
});

describe("negations", () => {
  it.each([
    ["I am not allergic to penicillin.", "not allergic to penicillin"],
    ["I do not have chest pain.", "do not have chest pain"],
    ["I have never had surgery.", "never had surgery"],
    ["I am not pregnant.", "not pregnant"],
    ["I don't smoke, but my husband does.", "don't smoke"],
    ["I cannot take aspirin; it makes my stomach bleed.", "cannot take aspirin"],
    ["The rash is not itchy.", "not itchy"],
  ])("%s", (text, expected) => {
    expect(values(text, "negation")[0]).toBe(expected);
  });
  it("a dropped 'not' changes the value, which is the whole point", () => {
    expect(values("I am allergic to penicillin.", "negation")).toEqual([]);
  });
  it("'no more than three a day' is a cap, not a negation", () => {
    expect(values("Only when the pain is bad, no more than three a day.", "negation")).toEqual([]);
  });
});

describe("drugs", () => {
  it("finds known drug names, case-insensitive", () => {
    expect(values("The doctor gave me Metformin for my sugar.", "drug")).toEqual(["metformin"]);
    expect(values("They gave me paracetamol, not ibuprofen.", "drug")).toEqual(["paracetamol", "ibuprofen"]);
    expect(values("I use a salbutamol inhaler.", "drug")).toEqual(["salbutamol"]);
  });
});

describe("body parts and sides", () => {
  it.each([
    ["The pain is in my left knee, not the right.", "left knee"],
    ["My right eye is blurry.", "right eye"],
    ["The swelling is on my lower left leg.", "lower left leg"],
    ["My left arm goes numb at night.", "left arm"],
    ["The lump is in my right breast.", "right breast"],
    ["My back hurts on the lower right side.", "lower right back"],
    ["The headache is behind my left eye.", "left eye"],
  ])("%s", (text, expected) => {
    expect(values(text, "body_part")[0]).toBe(expected);
  });
  it("left and right are different values", () => {
    expect(values("The pain is in my left knee.", "body_part")).not.toEqual(values("The pain is in my right knee.", "body_part"));
  });
});

describe("Ethiopian dates", () => {
  it("resolves a yearless date to the most recent past occurrence", () => {
    const [f] = factsOfType(extractFacts("The fever started on Tikimt 3.", { reference: ref }), "date");
    expect(f.value).toBe("2026-10-13");
    expect(f.note).toContain("Tikimt 3, 2019 (Ethiopian) = October 13, 2026");
  });
  it("uses the spoken year when there is one", () => {
    expect(values("I was born on Hidar 12, 1980.", "date")).toEqual(["1987-11-22"]);
    expect(values("I had surgery on Tir 20, 2018.", "date")).toEqual(["2026-01-28"]);
  });
  it("an appointment resolves forward", () => {
    expect(values("My next appointment is on Tahsas 10.", "date")).toEqual(["2026-12-19"]);
  });
  it("Pagume 3 resolves; Pagume 6 in a non-leap year is invalid", () => {
    expect(values("The cough started on Pagume 3.", "date")).toEqual(["2026-09-08"]);
    expect(values("It was Pagume 6, 2018.", "date")).toEqual(["invalid"]);
  });
  it("Afaan Oromo month names are flagged as ambiguous between calendars", () => {
    const [f] = factsOfType(extractFacts("My last period began on Fulbaana 28.", { reference: ref, language: "om" }), "date");
    expect(f.value).toBe("2026-10-08");
    expect(f.note).toContain("both calendars");
    const [g] = factsOfType(extractFacts("The fever started on Tikimt 3.", { reference: ref, language: "am" }), "date");
    expect(g.note).not.toContain("both calendars");
  });
});

describe("durations", () => {
  it.each([
    ["I have had this cough for three weeks.", "3 week"],
    ["The bleeding lasted five days.", "5 day"],
    ["I have been taking this medicine for two years.", "2 year"],
    ["I stopped taking it two days ago.", "2 day ago"],
    ["The dizziness started two hours after the injection.", "2 hour after"],
  ])("%s", (text, expected) => {
    expect(values(text, "duration")[0]).toBe(expected);
  });
});

describe("found by the evaluation harness (Day 3)", () => {
  const opts = { reference: { year: 2026, month: 10, day: 26 } };
  const vals = (s: string, language?: "am" | "om") => extractFacts(s, { ...opts, language }).map(f => `${f.type}=${f.value}`);
  it("twice a day is a frequency, not a one-day duration", () => {
    const v = vals("Take one tablet of metformin 500 milligrams twice a day with food.");
    expect(v).toContain("frequency=2/day");
    expect(v.filter(x => x.startsWith("duration"))).toEqual([]);
  });
  it("not more than three times a day is a ceiling, not a plain frequency", () => {
    const v = vals("Take half a tablet at night, as needed, not more than three times a day.");
    expect(v).toContain("frequency=max 3/day");
    expect(v).not.toContain("frequency=3/day");
    expect(vals("At most two a day.")).toContain("frequency=max 2/day");
  });
  it("recognises the common spellings of the Afaan Oromo month", () => {
    for (const s of ["Onkololeessa 5", "Onkoloolessa 5", "Onkololessa 5"]) {
      const f = extractFacts(`My next appointment is on ${s}.`, { ...opts, language: "om" });
      expect(f.map(x => x.type)).toContain("date");
      expect(f.find(x => x.type === "date")?.note).toContain("both calendars");
    }
  });
});

describe("found by the recording script (Day 4)", () => {
  const opts = { reference: { year: 2026, month: 10, day: 31 } };
  const vals = (s: string) => extractFacts(s, opts).map(f => `${f.type}=${f.value}`);
  it("a count before the strength is a dose", () => {
    const v = vals("I was told to take one 10-milligram tablet of amlodipine.");
    expect(v).toContain("dose=1 tablet"); expect(v).toContain("dose=10 mg"); expect(v).toContain("drug=amlodipine");
  });
  it("no more than three a day leaks no duration", () => {
    const v = vals("Only when the pain is bad, no more than three a day.");
    expect(v).toContain("frequency=max 3/day"); expect(v).toContain("frequency=as needed");
    expect(v.filter(x => x.startsWith("duration"))).toEqual([]);
  });
  it("one in the morning and two at night keeps both counts", () => {
    const v = vals("One in the morning and two at night.");
    expect(v).toContain("frequency=1 morning"); expect(v).toContain("frequency=2 night");
  });
});

describe("found by the Day 10 code review", () => {
  const opts = { reference: { year: 2026, month: 10, day: 27 } };
  const vals = (s: string) => extractFacts(s, opts).map(f => `${f.type}=${f.value}`);
  it("a decimal comma is a decimal, a thousands comma is not", () => {
    expect(vals("Take 2,5 mg of warfarin.")).toContain("dose=2.5 mg");
    expect(vals("I take 1,000 milligrams of metformin.")).toContain("dose=1000 mg");
  });
  it("a month followed by a bare year is not a day", () => {
    expect(vals("She was born in Meskerem 2019.").filter(v => v.startsWith("date"))).toEqual([]);
    expect(vals("The pain began on Meskerem 30.")).toContain("date=2026-10-10");
  });
});

describe("numbers beyond the clinic (Day 11)", () => {
  const opts = { reference: { year: 2026, month: 10, day: 27 } };
  const vals = (s: string) => extractFacts(s, opts).map(f => `${f.type}=${f.value}`);
  it("counts, ages and money are numbers, not durations", () => {
    expect(vals("I have four children and I am 45 years old.")).toEqual(["number=4 children", "number=45 years old"]);
    expect(vals("I earn $1,200 a month and pay 800 dollars in rent.")).toEqual(["number=1200 USD", "number=800 USD"]);
    expect(vals("I have had this cough for three weeks.")).toEqual(["duration=3 week"]);
  });
  it("a year with its calendar is converted; a bare year is kept with a warning", () => {
    const ec = extractFacts("I arrived in 2011 E.C.", opts).find(f => f.type === "number")!;
    expect(ec.value).toBe("year 2018/2019");
    expect(ec.note).toContain("September 2018");
    const bare = extractFacts("I arrived in 2011.", opts).find(f => f.type === "number")!;
    expect(bare.value).toBe("year 2011");
    expect(bare.note).toContain("confirm which calendar");
    expect(extractFacts("I arrived in 2024.", opts).find(f => f.type === "number")!.note).toBeUndefined();
  });
  it("numbers already inside a dose, date or duration are not repeated", () => {
    expect(vals("Take 500 milligrams. I was born on Hidar 12, 1980.").filter(v => v.startsWith("number"))).toEqual([]);
  });
});

describe("found by the first live Amharic turn (Oct 28)", () => {
  const opts = { reference: { year: 2026, month: 10, day: 28 } };
  const vals = (s: string) => extractFacts(s, opts).map(f => `${f.type}=${f.value}`);
  it("compound number words are one number", () => {
    expect(vals("He is giving me five hundred milligrams amoxicillin twice a day.")).toEqual(["dose=500 mg", "drug=amoxicillin", "frequency=2/day"]);
    expect(vals("Take twenty-five milligrams.")).toContain("dose=25 mg");
    expect(vals("I take one thousand two hundred milligrams.")).toContain("dose=1200 mg");
    expect(vals("Take two and a half tablets.")).toContain("dose=2.5 tablet");
    expect(vals("I take a hundred milligrams.")).toContain("dose=100 mg");
  });
  it("a and an never join a run of number words", () => {
    expect(vals("Take five a day.")).toEqual([]); // no "N a day" pattern exists; the point is that "five a" is not read as six of anything
    expect(vals("Three times a day.")).toEqual(["frequency=3/day"]);
  });
  it("the spoken-number sentences from the recording script still read right", () => {
    expect(vals("The doctor told me to take two tablets of 500 milligrams.")).toEqual(["dose=2 tablet", "dose=500 mg"]);
    expect(vals("Only once a week, on Sundays.")).toEqual(["frequency=1/week", "frequency=sunday"]);
    expect(vals("One in the morning and two at night.")).toEqual(["frequency=1 morning", "frequency=2 night"]);
  });
});

