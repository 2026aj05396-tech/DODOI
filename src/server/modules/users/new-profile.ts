import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { findTakenUsernames } from "./repository";
import { usernameCandidates } from "./username";

// Defaults for the profile created at sign-up, shared by Google and email registration.

const DISPLAY_NAME_MAX_LENGTH = 50;

export function emailLocalPart(email: string): string {
  return email.split("@")[0] ?? email;
}

/** The given name, tidied; the email local-part when there is none (email sign-ups). */
export function toDisplayName(name: string | null, email: string): string {
  const cleaned = (name ?? "").trim().replace(/\s+/g, " ");
  return (cleaned.length > 0 ? cleaned : emailLocalPart(email)).slice(0, DISPLAY_NAME_MAX_LENGTH);
}

/** First free username from the display name, then the email local-part (OD-11, DC-26). */
export async function chooseAvailableUsername(
  displayName: string,
  email: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const candidates = usernameCandidates([displayName, emailLocalPart(email)]);
  const taken = await findTakenUsernames(candidates, tx);
  const username = candidates.find((candidate) => !taken.has(candidate));
  if (!username) throw new Error("No free username candidate for a new account");
  return username;
}

/** Concurrent sign-ups can collide on email, account or username; callers retry on this. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
