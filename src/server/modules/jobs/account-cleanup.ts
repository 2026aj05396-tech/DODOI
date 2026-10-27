import "server-only";

import { db } from "@/server/db/client";
import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import { logger } from "@/server/lib/logger";
import { deleteContentOfUser, deleteUnusedMedia } from "@/server/modules/content";
import { deleteAccountIfDue, getAccountsDueForDeletion } from "@/server/modules/users";

// Account hard delete (P1-28, SECURITY_AND_PRIVACY §7.3), run by the daily jobs: accounts whose
// 14-day grace period has ended and never-verified accounts older than 30 days. Cascades remove
// the profile, Google link, tokens, skills, saves, collections, progress, feed data and reports
// the user filed; custom skills and audit-log rows stay with the user removed. Posts the user
// authored (invited creators) are deleted (PO decision 2026-10-27), then their media and the
// user's uploads (avatars) are deleted from Cloudinary.

/** Thrown inside the transaction to roll it back when the account is no longer due. */
class NoLongerDue extends Error {}

/** Deletes one account if still due. Returns false when it was cancelled meanwhile. */
async function deleteAccount(userId: string, now: Date, provider: MediaProvider): Promise<boolean> {
  let mediaIds: string[];
  try {
    mediaIds = await db.$transaction(async (tx) => {
      const used = await deleteContentOfUser(userId, tx);
      if (!(await deleteAccountIfDue(userId, tx, now))) throw new NoLongerDue();
      return used;
    });
  } catch (error) {
    if (error instanceof NoLongerDue) return false;
    throw error;
  }
  await deleteUnusedMedia(mediaIds, { provider });
  return true;
}

/**
 * Deletes every account that is due. One failing account does not stop the others; if any
 * failed, the job throws after the rest are done so the run is reported as failed.
 */
export async function deleteAccountsDue({
  now = new Date(),
  provider = defaultProvider,
}: { now?: Date; provider?: MediaProvider } = {}): Promise<number> {
  let deleted = 0;
  let failed = 0;
  for (const userId of await getAccountsDueForDeletion(now)) {
    try {
      if (await deleteAccount(userId, now, provider)) deleted += 1;
    } catch (error) {
      failed += 1;
      logger.error("Could not delete an account", { userId, error });
    }
  }
  if (deleted > 0) logger.info("Deleted accounts", { count: deleted });
  if (failed > 0) throw new Error(`${failed} account(s) could not be deleted; see the log.`);
  return deleted;
}
