import "server-only";

import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import { logger } from "@/server/lib/logger";
import { purgeExpiredRateLimitBuckets } from "@/server/lib/rate-limit";
import { deleteOrphanedMedia } from "@/server/modules/content";
import { purgeExpiredFeedSessions } from "@/server/modules/feed";
import { purgeOldNotifications } from "@/server/modules/notifications";
import { purgeSpentAuthTokens } from "@/server/modules/users";

import { deleteAccountsDue } from "./account-cleanup";

// Daily maintenance (P1-33, SYSTEM_ARCHITECTURE §12b, DATABASE_SCHEMA §7), run by `pnpm jobs:daily`.
// Every job is idempotent, so a missed or repeated run is harmless, and runs even if an earlier
// one failed. What triggers the run on a hosted environment is decided with hosting (OD-01).

/** Longest rate-limit window in use (custom skills and reports: 1 per day). */
const LONGEST_RATE_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;

type JobContext = { now: Date; provider: MediaProvider };

const DAILY_JOBS: { name: string; run: (context: JobContext) => Promise<number> }[] = [
  // First, so media of deleted accounts are cleaned up in the same run.
  { name: "delete-accounts", run: ({ now, provider }) => deleteAccountsDue({ now, provider }) },
  { name: "purge-auth-tokens", run: ({ now }) => purgeSpentAuthTokens(now) },
  { name: "purge-feed-sessions", run: ({ now }) => purgeExpiredFeedSessions(now) },
  // NTF-05: notifications are kept 90 days.
  { name: "purge-notifications", run: ({ now }) => purgeOldNotifications(now) },
  {
    name: "purge-rate-limit-buckets",
    run: ({ now }) => purgeExpiredRateLimitBuckets(LONGEST_RATE_LIMIT_WINDOW_SECONDS, { now }),
  },
  {
    name: "delete-orphaned-media",
    run: ({ now, provider }) => deleteOrphanedMedia({ now, provider }),
  },
];

export type DailyJobOutcome =
  { job: string; ok: true; count: number } | { job: string; ok: false; error: string };

/** Runs every daily job in order and reports how many rows each removed, or why it failed. */
export async function runDailyJobs({
  now = new Date(),
  provider = defaultProvider,
}: { now?: Date; provider?: MediaProvider } = {}): Promise<DailyJobOutcome[]> {
  const outcomes: DailyJobOutcome[] = [];
  for (const job of DAILY_JOBS) {
    try {
      outcomes.push({ job: job.name, ok: true, count: await job.run({ now, provider }) });
    } catch (error) {
      logger.error("Daily job failed", { job: job.name, error });
      outcomes.push({
        job: job.name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return outcomes;
}
