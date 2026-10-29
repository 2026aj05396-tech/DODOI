import "server-only";

import { db } from "@/server/db/client";

/** A user's role, or null when there is no such user (admins assign moderators, MOD-03). */
export async function getUserRole(userId: string): Promise<"USER" | "MODERATOR" | "ADMIN" | null> {
  const row = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return row?.role ?? null;
}

/** Changes a user's role; the session reads it from the database on every request. */
export async function setUserRole(userId: string, role: "USER" | "MODERATOR"): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { role },
  });
}
