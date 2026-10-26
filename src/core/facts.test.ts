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
    const [f] = extractFacts("I was told to take one 10-milligram tablet of amlodipine.");
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
