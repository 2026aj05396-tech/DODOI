import { describe, expect, it } from "vitest";

import {
  isReservedUsername,
  toUsernameBase,
  USERNAME_PATTERN,
  usernameCandidates,
  withRandomSuffix,
} from "./username";

describe("toUsernameBase", () => {
  it.each([
    ["Aanya", "aanya"],
    ["Aanya Sharma", "aanya-sharma"],
    ["  Zoë   Ölund ", "zoe-olund"],
    ["priya.m_crafts", "priya-m_crafts"],
    ["42 Knitting Nana", "knitting-nana"],
    ["a--b__c", "a-b_c"],
    ["Bartholomew Featherstonehaugh", "bartholomew-feathers"],
  ])("turns %j into %j", (source, expected) => {
    expect(toUsernameBase(source)).toBe(expected);
  });

  it.each(["आन्या", "Al", "12345", "  ", "--"])(
    "returns null for %j (fewer than 3 usable characters)",
    (source) => {
      expect(toUsernameBase(source)).toBeNull();
    },
  );

  it("never ends with a separator after truncation", () => {
    expect(toUsernameBase("abcdefghijklmnopqrs-tuv")).toBe("abcdefghijklmnopqrs");
  });
});

describe("withRandomSuffix", () => {
  it("adds a dash and 4 digits", () => {
    expect(withRandomSuffix("aanya", "4821")).toBe("aanya-4821");
  });

  it("shortens long bases so the result stays within 20 characters", () => {
    const username = withRandomSuffix("bartholomew-feathers", "0007");
    expect(username).toBe("bartholomew-fea-0007");
    expect(username).toHaveLength(20);
  });
});

describe("usernameCandidates", () => {
  it("tries the plain base first, then suffixed variants that all follow the rules", () => {
    const candidates = usernameCandidates(["Aanya", "aanya.k"]);

    expect(candidates[0]).toBe("aanya");
    expect(candidates).toHaveLength(6);
    for (const candidate of candidates) {
      expect(candidate).toMatch(USERNAME_PATTERN);
    }
    for (const candidate of candidates.slice(1)) {
      expect(candidate).toMatch(/^aanya-\d{4}$/);
    }
  });

  it("falls back to the email local-part when the name has no usable characters", () => {
    expect(usernameCandidates(["आन्या", "aanya.k"])[0]).toBe("aanya-k");
  });

  it('falls back to "maker" when no source is usable', () => {
    expect(usernameCandidates(["आन्या", "42"])[0]).toBe("maker");
  });

  it("never offers a reserved name on its own", () => {
    const candidates = usernameCandidates(["Admin"]);

    expect(candidates).not.toContain("admin");
    expect(candidates[0]).toMatch(/^admin-\d{4}$/);
  });
});

describe("isReservedUsername", () => {
  it("blocks route names and team-sounding names case-insensitively", () => {
    expect(isReservedUsername("settings")).toBe(true);
    expect(isReservedUsername("Dodoi")).toBe(true);
    expect(isReservedUsername("aanya")).toBe(false);
  });
});
