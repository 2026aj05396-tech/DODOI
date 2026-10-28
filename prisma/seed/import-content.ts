// `pnpm seed:content [folder] [--check] [--confirm-production]`: imports seed posts (P1-18) from
// `<folder>/posts/*.json` (default `./seed-content`, kept outside git). `--check` only validates.
// Either way it ends with coverage against the OD-31 launch minimums, counting the valid files
// that publish (themes are assigned in /admin, so /admin/coverage reports them).
// Runs with the react-server condition so server-only modules can be imported outside Next.js.
import type { SeedCoverage } from "@/lib/types/seed-coverage";
import { postTypeLabel } from "@/lib/utils/post-labels";
import { db } from "@/server/db/client";
import { serverEnv } from "@/server/lib/env";
import {
  computeSeedCoverage,
  importSeedContent,
  type SeedImportOutcome,
} from "@/server/modules/content";
import { getActivePredefinedSkills } from "@/server/modules/skills";

const DEFAULT_FOLDER = "seed-content";

function coverageReport(coverage: SeedCoverage, counted: number, failed: number): string {
  const lines = [`Launch coverage (OD-31) from ${counted} publishing files:`];
  if (failed > 0) {
    lines.push(`  (${failed} failed ${failed === 1 ? "file is" : "files are"} not counted)`);
  }

  const skillsMet = coverage.skills.filter((row) => row.met).length;
  lines.push(`  Skills: ${skillsMet} of ${coverage.skills.length} meet the minimum`);
  for (const row of coverage.skills.filter((skill) => !skill.met)) {
    const tutorials = row.focus ? `, ${row.tutorials}/${row.minTutorials} tutorials` : "";
    const label = `${row.name}${row.focus ? " (focus)" : ""}`;
    lines.push(`    ✗ ${label.padEnd(28)} ${row.posts}/${row.minPosts} posts${tutorials}`);
  }
  const typesMet = coverage.types.filter((row) => row.met).length;
  lines.push(`  Post types: ${typesMet} of ${coverage.types.length} meet the minimum`);
  for (const row of coverage.types.filter((type) => !type.met)) {
    lines.push(`    ✗ ${postTypeLabel(row.type, null).padEnd(28)} ${row.posts}/${row.min} posts`);
  }
  if (coverage.missingFocusSkills.length > 0) {
    lines.push(`  ✗ Launch-focus skills not found: ${coverage.missingFocusSkills.join(", ")}`);
  }
  lines.push("  Themes: assigned in /admin; see /admin/coverage.");
  lines.push(
    coverage.gaps === 0 ? "All skill and type minimums met." : `${coverage.gaps} gaps left.`,
  );
  return `${lines.join("\n")}\n`;
}

async function printCoverage(outcomes: SeedImportOutcome[]): Promise<void> {
  const posts = outcomes.flatMap((outcome) =>
    outcome.result !== "failed" && outcome.post.publish
      ? [{ type: outcome.post.type, skills: outcome.post.skills, themes: [] }]
      : [],
  );
  const failed = outcomes.filter((outcome) => outcome.result === "failed").length;
  const coverage = computeSeedCoverage({
    posts,
    skills: await getActivePredefinedSkills(),
    themes: null,
  });
  process.stdout.write(`\n${coverageReport(coverage, posts.length, failed)}`);
}

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
  await printCoverage(outcomes);
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
