import { describe, expect, it } from "vitest";

import { generateToken, hashToken } from "./tokens";

describe("generateToken", () => {
  it("returns a URL-safe 32-byte token and the SHA-256 hash that is stored", () => {
    const { rawToken, tokenHash } = generateToken();

    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(rawToken)).toBe(tokenHash);
  });

  it("never repeats", () => {
    expect(generateToken().rawToken).not.toBe(generateToken().rawToken);
  });
});
