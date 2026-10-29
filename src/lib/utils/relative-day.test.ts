import { describe, expect, it } from "vitest";

import { relativeDay } from "./relative-day";

describe("relativeDay", () => {
  const now = new Date(2026, 9, 29, 9, 0);

  it.each([
    [new Date(2026, 9, 29, 7, 0), "today"],
    [new Date(2026, 9, 28, 23, 30), "yesterday"],
    [new Date(2026, 9, 23, 12, 0), "6 days ago"],
    [new Date(2026, 9, 1, 12, 0), "4 weeks ago"],
    [new Date(2026, 6, 1, 12, 0), "4 months ago"],
    [new Date(2024, 9, 1, 12, 0), "2 years ago"],
  ])("%s → %s", (date, expected) => {
    expect(relativeDay(date.toISOString(), now)).toBe(expected);
  });
});
