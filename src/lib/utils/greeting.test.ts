import { describe, expect, it } from "vitest";

import { feedGreeting, firstName } from "./greeting";

describe("feed greeting", () => {
  it("takes a readable first name from the display name", () => {
    expect(firstName("Aanya Sharma")).toBe("Aanya");
    expect(firstName("priyanshi.moonat")).toBe("Priyanshi");
    expect(firstName("maker_42")).toBe("Maker");
    expect(firstName("McKenzie")).toBe("McKenzie");
    expect(firstName("प्रिया शर्मा")).toBe("प्रिया");
    expect(firstName("42")).toBeNull();
    expect(firstName("j.doe")).toBeNull();
  });

  it("says today before 5 pm India time and tonight after", () => {
    // 11:29 UTC = 16:59 IST; 11:30 UTC = 17:00 IST.
    expect(feedGreeting("Aanya", new Date("2026-10-27T11:29:00Z"))).toBe(
      "What will you make today, Aanya?",
    );
    expect(feedGreeting("Aanya", new Date("2026-10-27T11:30:00Z"))).toBe(
      "What will you make tonight, Aanya?",
    );
  });

  it("leaves the name out when there is none", () => {
    expect(feedGreeting(null, new Date("2026-10-27T15:00:00Z"))).toBe(
      "What will you make tonight?",
    );
  });
});
