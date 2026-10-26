// `pnpm seed:content [folder] [--check] [--confirm-production]`: imports seed posts (P1-18) from
// `<folder>/posts/*.json` (default `./seed-content`, kept outside git). `--check` only validates.
// Runs with the react-server condition so server-only modules can be imported outside Next.js.
import { db } from "@/server/db/client";
import { serverEnv } from "@/server/lib/env";
import { importSeedContent } from "@/server/modules/content";

const DEFAULT_FOLDER = "seed-content";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (serverEnv.APP_ENV === "production" && !args.includes("--confirm-production")) {
    throw new Error(
      "Refusing to import into production without --confirm-production (SYSTEM_ARCHITECTURE §13).",
    );
  }
  const check = args.includes("--check");
  const folder = args.find((arg) => !arg.startsWith("--")) ?? DEFAULT_FOLDER;

  const outcomes = await importSeedContent(folder, { check });
  for (const outcome of outcomes) {
    if (outcome.result === "failed") {
      process.stdout.write(
        `✗ ${outcome.file}\n${outcome.problems.map((p) => `    ${p}\n`).join("")}`,
      );
    } else if (outcome.result === "checked") {
      process.stdout.write(`✓ ${outcome.file}: ready to import\n`);
    } else {
      process.stdout.write(
        `✓ ${outcome.file}: ${outcome.result}, ${outcome.status.toLowerCase()}, ${outcome.uploaded} uploaded\n`,
      );
    }
  }

  const failed = outcomes.filter((outcome) => outcome.result === "failed").length;
  process.stdout.write(
    `\n${outcomes.length - failed} of ${outcomes.length} files ${check ? "valid" : "imported"}.\n`,
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `Import failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
