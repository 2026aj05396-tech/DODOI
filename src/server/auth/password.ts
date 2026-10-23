import "server-only";

import argon2 from "argon2";

// Password hashing (SECURITY_AND_PRIVACY §2.2): Argon2id with the library's default cost
// (64 MiB memory, 3 iterations, parallelism 4). Plaintext is never stored or logged.

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

// Hash of a random value nobody knows. Verifying against it when an account has no password (or
// does not exist) costs the same time as a real check, so response times don't reveal which.
let dummyHash: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(crypto.randomUUID());
  return dummyHash;
}

/**
 * Checks `password` against `hash`. With a `null` hash it still does the full work and returns
 * false, so callers can always call it once per attempt.
 */
export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  if (hash === null) {
    await argon2.verify(await getDummyHash(), password);
    return false;
  }
  try {
    return await argon2.verify(hash, password);
  } catch {
    // A malformed stored hash must not sign anyone in.
    return false;
  }
}
