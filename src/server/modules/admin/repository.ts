import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

type Client = Prisma.TransactionClient | typeof db;

export async function insertAuditLog(
  data: {
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Prisma.InputJsonValue;
  },
  client: Client,
): Promise<void> {
  await client.auditLog.create({ data });
}
