import { describe, expect, it } from "vitest";

import { ageOn, checkDateOfBirth } from "./age";

// 2026-10-23 18:00 UTC is already 2026-10-23 23:30 in India; 19:00 UTC is 2026-10-24 00:30.
const EVENING_UTC = new Date("2026-10-23T18:00:00Z");
const AFTER_IST_MIDNIGHT = new Date("2026-10-23T19:00:00Z");

describe("checkDateOfBirth", () => {
  it("accepts someone who turns 18 today", () => {
    expect(checkDateOfBirth("2008-10-23", EVENING_UTC)).toBe("adult");
  });

  it("refuses someone who turns 18 tomorrow", () => {
    expect(checkDateOfBirth("2008-10-24", EVENING_UTC)).toBe("under-minimum-age");
  });

  it("uses the calendar date in India, not UTC", () => {
    expect(checkDateOfBirth("2008-10-24", AFTER_IST_MIDNIGHT)).toBe("adult");
  });

  it.each(["2008-02-30", "2008-13-01", "not-a-date", "2027-01-01", "1890-01-01"])(
    "treats %j as invalid",
    (value) => {
      expect(checkDateOfBirth(value, EVENING_UTC)).toBe("invalid");
    },
  );
});

describe("ageOn", () => {
  it("counts a 29 February birthday from 1 March in other years", () => {
    const birth = { year: 2008, month: 2, day: 29 };

    expect(ageOn(birth, { year: 2026, month: 2, day: 28 })).toBe(17);
    expect(ageOn(birth, { year: 2026, month: 3, day: 1 })).toBe(18);
  });
});
