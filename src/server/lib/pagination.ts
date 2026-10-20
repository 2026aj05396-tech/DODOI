import "server-only";

import type { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants/pagination";
import { ValidationError } from "@/server/lib/errors";

/** Encodes a cursor payload as an opaque URL-safe string. */
export function encodeCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/** Decodes and validates a cursor. Tampered or malformed cursors are a client error, not a crash. */
export function decodeCursor<TSchema extends z.ZodType>(
  cursor: string,
  schema: TSchema,
): z.output<TSchema> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch (error) {
    throw new ValidationError("This list link is no longer valid.", {
      fields: { cursor: "Invalid cursor" },
      cause: error,
    });
  }

  const result = schema.safeParse(decoded);
  if (!result.success) {
    throw new ValidationError("This list link is no longer valid.", {
      fields: { cursor: "Invalid cursor" },
    });
  }
  return result.data;
}

/** Applies the default page size and the server-enforced maximum. */
export function resolvePageSize(requested: number | undefined): number {
  if (requested === undefined) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(requested), 1), MAX_PAGE_SIZE);
}
