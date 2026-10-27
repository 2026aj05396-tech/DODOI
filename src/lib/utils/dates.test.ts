import { describe, expect, it } from "vitest";

import { formatLongDate } from "./dates";

describe("formatLongDate", () => {
  it("writes day, month name and year", () => {
    expect(formatLongDate(new Date(2026, 10, 10, 12))).toBe("10 November 2026");
  });

  it("accepts an ISO timestamp", () => {
    expect(formatLongDate(new Date(2026, 0, 3, 12).toISOString())).toBe("3 January 2026");
  });
});
