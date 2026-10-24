import { describe, expect, it } from "vitest";

import { canCreateCustomSkill } from "./policies";

describe("canCreateCustomSkill", () => {
  it("allows only signed-in users with a verified email", () => {
    expect(
      canCreateCustomSkill({ id: "u1", role: "USER", isEmailVerified: true, isAgeConfirmed: true }),
    ).toBe(true);
    expect(
      canCreateCustomSkill({
        id: "u1",
        role: "USER",
        isEmailVerified: false,
        isAgeConfirmed: true,
      }),
    ).toBe(false);
    expect(canCreateCustomSkill(null)).toBe(false);
  });
});
