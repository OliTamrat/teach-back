import { describe, expect, it } from "vitest";
import {
  toGregorian, toEthiopian, isEthiopianLeapYear, isValidEthiopian, resolveYearless,
  formatGregorian, gregorianToJdn, ethiopianToJdn, jdnToEthiopian,
} from "./calendar";

const g = (year: number, month: number, day: number) => ({ year, month, day });

describe("Ethiopian to Gregorian", () => {
  it.each([
    [g(2019, 1, 1), "September 11, 2026", "New Year, ordinary year"],
    [g(2019, 1, 15), "September 25, 2026", "day offset inside the first month"],
    [g(2018, 5, 1), "January 9, 2026", "crossing the Gregorian year boundary"],
    [g(2020, 1, 1), "September 12, 2027", "New Year after an Ethiopian leap year"],
    [g(2019, 13, 6), "September 11, 2027", "sixth Pagume day exists only in a leap year"],
    [g(1980, 3, 12), "November 22, 1987", "a birth date decades back"],
    [g(2019, 2, 3), "October 13, 2026", "Tikimt 3"],
    [g(2019, 1, 28), "October 8, 2026", "Meskerem 28"],
    [g(2018, 5, 20), "January 28, 2026", "Tir 20, 2018"],
    [g(2017, 9, 5), "May 13, 2025", "Ginbot 5, 2017"],
    [g(2019, 4, 10), "December 19, 2026", "Tahsas 10"],
    [g(2018, 11, 15), "July 22, 2026", "Hamle 15, 2018"],
    [g(2018, 13, 3), "September 8, 2026", "Pagume 3"],
    [g(2016, 7, 1), "March 10, 2024", "Megabit 1, 2016"],
  ])("%o -> %s (%s)", (eth, expected) => {
    const out = toGregorian(eth);
    expect(out && formatGregorian(out)).toBe(expected);
  });

  it("rejects Pagume 6 in a non-leap year instead of guessing", () => {
    expect(toGregorian(g(2018, 13, 6))).toBeNull();
    expect(isValidEthiopian(g(2018, 13, 6))).toBe(false);
    expect(isValidEthiopian(g(2019, 13, 6))).toBe(true);
  });

  it("rejects day 31 and month 14", () => {
    expect(toGregorian(g(2019, 2, 31))).toBeNull();
    expect(toGregorian(g(2019, 14, 1))).toBeNull();
    expect(toGregorian(g(2019, 0, 1))).toBeNull();
  });
});

describe("leap years", () => {
  it("year mod 4 === 3", () => {
    expect(isEthiopianLeapYear(2019)).toBe(true);
    expect(isEthiopianLeapYear(2018)).toBe(false);
    expect(isEthiopianLeapYear(2015)).toBe(true);
  });
});

describe("round trips", () => {
  it("every day of 2018 and 2019 round-trips through Gregorian", () => {
    for (const year of [2018, 2019]) {
      for (let month = 1; month <= 13; month++) {
        const len = month < 13 ? 30 : isEthiopianLeapYear(year) ? 6 : 5;
        for (let day = 1; day <= len; day++) {
          const eth = g(year, month, day);
          const greg = toGregorian(eth);
          expect(greg).not.toBeNull();
          expect(toEthiopian(greg!)).toEqual(eth);
        }
      }
    }
  });

  it("JDN helpers agree with each other", () => {
    const jdn = gregorianToJdn(g(2026, 9, 11));
    expect(jdn).toBe(ethiopianToJdn(g(2019, 1, 1)));
    expect(jdnToEthiopian(jdn)).toEqual(g(2019, 1, 1));
  });
});

describe("yearless dates resolve against a reference day", () => {
  const recordingDay = g(2026, 10, 31);
  it("picks the most recent past occurrence by default", () => {
    expect(resolveYearless(2, 3, recordingDay)).toEqual(g(2019, 2, 3));      // Tikimt 3 -> Oct 13, 2026
    expect(resolveYearless(1, 30, recordingDay)).toEqual(g(2019, 1, 30));    // Meskerem 30 -> Oct 10, 2026
    expect(resolveYearless(13, 3, recordingDay)).toEqual(g(2018, 13, 3));    // Pagume 3 -> Sep 8, 2026
  });
  it("picks the next occurrence for appointments", () => {
    expect(resolveYearless(4, 10, recordingDay, true)).toEqual(g(2019, 4, 10)); // Tahsas 10 -> Dec 19, 2026
  });
  it("returns null when the day never exists", () => {
    expect(resolveYearless(13, 7, recordingDay)).toBeNull();
  });
});
