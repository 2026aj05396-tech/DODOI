import "server-only";

import { connection } from "next/server";
import { cache } from "react";

import type { Actor } from "@/server/lib/actor";

import { auth } from "./config";

/**
 * The signed-in user for this request, or null (Data Access Layer, SECURITY_AND_PRIVACY §3).
 * Validates the session against the database (`sessionVersion`, user still exists) and is
 * memoised per request, so pages, layouts and helpers can all call it.
 */
export const getActor = cache(async (): Promise<Actor> => {
  // Auth.js uses random values while reading the session. Partial prefetching may otherwise
  // pre-render this with the request's cookies, where Next.js forbids randomness.
  await connection();
  const session = await auth();
  return session?.actor ?? null;
});
