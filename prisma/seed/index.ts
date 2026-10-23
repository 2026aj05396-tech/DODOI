// `pnpm db:seed` / `prisma db seed`: loads reference data. Safe to run repeatedly.
// Runs with the react-server condition so server-only modules can be imported outside Next.js.
import { db } from "@/server/db/client";
import { serverEnv } from "@/server/lib/env";
import { seedPredefinedSkills, type PredefinedSkillsData } from "@/server/modules/skills";

import skillsData from "./skills.json";

async function main(): Promise<void> {
  if (serverEnv.APP_ENV === "production" && !process.argv.includes("--confirm-production")) {
    throw new Error(
      "Refusing to seed production without --confirm-production (SYSTEM_ARCHITECTURE §13).",
    );
  }

  const skills = await seedPredefinedSkills(skillsData as PredefinedSkillsData);
  process.stdout.write(
    `Skills: ${skills.created} created, ${skills.updated} updated, ${skills.relations} new relations\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `Seed failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
