import { describe, expect, it } from "vitest";

import { formatMinutes, levelLabel, postTypeLabel } from "./post-labels";

describe("post labels", () => {
  it("formats minutes and hours", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(90)).toBe("1 h 30 min");
  });

  it("adds the time to tutorials only", () => {
    expect(postTypeLabel("TUTORIAL", 20)).toBe("Tutorial · 20 min");
    expect(postTypeLabel("TUTORIAL", null)).toBe("Tutorial");
    expect(postTypeLabel("FIRST_ATTEMPT", 20)).toBe("First attempt");
  });

  it("names experience levels", () => {
    expect(levelLabel("BEGINNER")).toBe("Beginner");
  });
});
