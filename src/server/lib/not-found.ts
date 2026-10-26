import "server-only";

import { notFound } from "next/navigation";

import { NotFoundError } from "./errors";

/** For pages: a service's 404 (NotFoundError) becomes Next.js's not-found page. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}
