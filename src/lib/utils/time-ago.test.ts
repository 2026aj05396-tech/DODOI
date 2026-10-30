import { describe, expect, it } from "vitest";

import { timeAgo } from "./time-ago";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("timeAgo", () => {
  it("counts minutes, then hours, then calendar days", () => {
    expect(timeAgo(ago(20_000), NOW)).toBe("just now");
    expect(timeAgo(ago(5 * 60_000), NOW)).toBe("5m ago");
    expect(timeAgo(ago(2 * 3_600_000 + 5_000), NOW)).toBe("2h ago");
    expect(timeAgo(ago(3 * 86_400_000), NOW)).toBe("3 days ago");
    expect(timeAgo(ago(20 * 86_400_000), NOW)).toBe("2 weeks ago");
  });
});
