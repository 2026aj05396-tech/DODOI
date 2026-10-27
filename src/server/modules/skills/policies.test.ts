import { describe, expect, it } from "vitest";

import { canCreateCustomSkill } from "./policies";

const user = {
  id: "u1",
  role: "USER",
  isEmailVerified: true,
  isAgeConfirmed: true,
  isDeletionScheduled: false,
  signedInAt: null,
} as const;

describe("canCreateCustomSkill", () => {
  it("allows only signed-in users with a verified email", () => {
    expect(canCreateCustomSkill(user)).toBe(true);
    expect(canCreateCustomSkill({ ...user, isEmailVerified: false })).toBe(false);
    expect(canCreateCustomSkill(null)).toBe(false);
  });
});
