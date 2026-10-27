import { describe, expect, it } from "vitest";
import { createGuard, timingSafeEqual } from "./guard";

describe("the guard on model spending", () => {
  it("is open when no access code is configured, and closed to a wrong code when one is", () => {
    expect(createGuard({}).check("1.1.1.1", null).ok).toBe(true);
    const g = createGuard({ accessCode: "orange-river" });
    expect(g.check("1.1.1.1", null)).toMatchObject({ ok: false, status: 401, error: "access_required" });
    expect(g.check("1.1.1.1", "wrong")).toMatchObject({ ok: false, status: 401 });
    expect(g.check("1.1.1.1", " orange-river ").ok).toBe(true);
  });
  it("limits one caller per minute and lets another caller through", () => {
    let t = 1_000_000;
    const g = createGuard({ perMinute: 3 }, () => t);
    expect([1, 2, 3].map(() => g.check("a", null).ok)).toEqual([true, true, true]);
    expect(g.check("a", null)).toMatchObject({ ok: false, status: 429, error: "too_many" });
    expect(g.check("b", null).ok).toBe(true);
    t += 61_000;
    expect(g.check("a", null).ok).toBe(true);
  });
  it("caps the day and resets at midnight UTC", () => {
    let t = 86_400_000 * 100 + 1000;
    const g = createGuard({ perDay: 2, perMinute: 100 }, () => t);
    expect(g.check("a", null).ok).toBe(true); expect(g.check("b", null).ok).toBe(true);
    expect(g.check("c", null)).toMatchObject({ ok: false, error: "daily_cap" });
    t = 86_400_000 * 101 + 1000;
    expect(g.check("c", null).ok).toBe(true);
    expect(g.stats().dayCount).toBe(1);
  });
  it("a refused call does not count against the day", () => {
    const g = createGuard({ accessCode: "x", perDay: 1 });
    g.check("a", "nope");
    expect(g.stats().dayCount).toBe(0);
  });
  it("compares codes in constant shape", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});
