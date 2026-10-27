// `pnpm jobs:daily` (P1-33): purges expired data and deletes accounts that are due (P1-28). Safe to
// run any number of times. Exits with 1 if any job failed.
// Runs with the react-server condition so server-only modules can be imported outside Next.js.
import { db } from "@/server/db/client";
import { runDailyJobs } from "@/server/modules/jobs";

async function main(): Promise<void> {
  const outcomes = await runDailyJobs();
  for (const outcome of outcomes) {
    process.stdout.write(
      outcome.ok
        ? `✓ ${outcome.job}: ${outcome.count} removed\n`
        : `✗ ${outcome.job}: ${outcome.error}\n`,
    );
  }
  if (outcomes.some((outcome) => !outcome.ok)) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `Daily jobs failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
