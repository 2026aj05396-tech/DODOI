import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

import { insertAuditLog } from "./repository";

// Audit log (ADM-06, SECURITY_AND_PRIVACY §3): every admin mutation records who did what to which
// record. Callers pass their transaction so the entry is written together with the change.

export type AuditEntry = {
  actorId: string | null;
  /** `<target>.<verb>`, e.g. "post.publish", "skill.hide". */
  action: string;
  targetType: "post" | "comment" | "theme" | "skill" | "media" | "user" | "report" | "ai_message";
  targetId: string;
  /** Changed field names and similar; never sensitive content. */
  metadata?: Prisma.InputJsonValue;
};

export async function recordAudit(
  entry: AuditEntry,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  await insertAuditLog(entry, client);
}
