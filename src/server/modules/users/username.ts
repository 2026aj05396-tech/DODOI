import { randomInt } from "node:crypto";

// Username rules (OD-11): 3–20 characters, lowercase a–z, 0–9, `_` and `-`, starting with a letter,
// unique (stored lowercase, so case-insensitive), reserved names blocked. At sign-up a username is
// generated from the display name or the email local-part, with 4 random digits added if it is
// taken, e.g. `aanya-4821` (PRODUCT_REQUIREMENTS §3, DC-26).

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
const SUFFIX_DIGITS = 4;
/** Room for "-" plus the digits at the end of a maximum-length username. */
const SUFFIXED_BASE_MAX_LENGTH = USERNAME_MAX_LENGTH - SUFFIX_DIGITS - 1;
/** Used when neither the name nor the email gives at least 3 usable characters. */
const FALLBACK_BASE = "maker";

export const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{2,19}$/;

/**
 * Names that would collide with routes or could impersonate the team (OD-11 lists admin, dodoi,
 * api, support, help, settings, explore, …). Includes every top-level route in
 * SYSTEM_ARCHITECTURE §5 so `/u/<name>` never looks like a product page.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "about",
  "account",
  "admin",
  "administrator",
  "api",
  "auth",
  "dodoi",
  "explore",
  "feed",
  "forgot-password",
  "help",
  "login",
  "logout",
  "me",
  "moderator",
  "offline",
  "onboarding",
  "privacy",
  "profile",
  "reset-password",
  "root",
  "saved",
  "search",
  "security",
  "settings",
  "sign-in",
  "sign-out",
  "sign-up",
  "signin",
  "signout",
  "signup",
  "staff",
  "support",
  "system",
  "team",
  "terms",
  "verify-email",
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}

/**
 * Turns free text into a username candidate: accents removed, lowercase, other characters become
 * `-`, leading characters up to the first letter dropped. Returns null if fewer than 3 remain
 * (e.g. a name written only in Devanagari).
 */
export function toUsernameBase(source: string): string | null {
  const slug = source
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/[-_]{2,}/g, (run) => run.charAt(0))
    .replace(/^[^a-z]+/, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/[-_]+$/, "");
  return slug.length >= USERNAME_MIN_LENGTH ? slug : null;
}

function randomSuffix(): string {
  return String(randomInt(0, 10 ** SUFFIX_DIGITS)).padStart(SUFFIX_DIGITS, "0");
}

/** `base` shortened to leave room for a suffix, then `-NNNN`. */
export function withRandomSuffix(base: string, suffix = randomSuffix()): string {
  const trimmed = base.slice(0, SUFFIXED_BASE_MAX_LENGTH).replace(/[-_]+$/, "");
  return `${trimmed}-${suffix}`;
}

/**
 * Candidates to try in order: the plain base (unless reserved), then `attempts` suffixed variants.
 * `sources` are tried in order (e.g. display name, then email local-part).
 */
export function usernameCandidates(sources: readonly string[], attempts = 5): string[] {
  const base = sources.map(toUsernameBase).find((candidate) => candidate !== null) ?? FALLBACK_BASE;
  const candidates = isReservedUsername(base) ? [] : [base];
  for (let index = 0; index < attempts; index += 1) {
    candidates.push(withRandomSuffix(base));
  }
  return candidates;
}
