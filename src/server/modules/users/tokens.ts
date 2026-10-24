import { createHash, randomBytes } from "node:crypto";

// Email verification and password reset tokens (SECURITY_AND_PRIVACY §2.3): 32 random bytes,
// URL-safe; only the SHA-256 hash is stored, so a database leak cannot be turned into links.

const TOKEN_BYTES = 32;

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  return { rawToken, tokenHash: hashToken(rawToken) };
}
