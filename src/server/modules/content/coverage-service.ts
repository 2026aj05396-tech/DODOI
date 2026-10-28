import "server-only";

import type { SeedCoverage } from "@/lib/types/seed-coverage";
import { requireAdmin, type Actor } from "@/server/lib/actor";
import { getActivePredefinedSkills } from "@/server/modules/skills";

import { findPublishedPostsForCoverage, findPublishedThemes } from "./post-repository";
import { computeSeedCoverage } from "./seed-coverage";

/** Admin Coverage page (P1-19): published content against the OD-31 launch minimums. */
export async function getSeedCoverage(actor: Actor): Promise<SeedCoverage> {
  requireAdmin(actor);
  const [posts, skills, themes] = await Promise.all([
    findPublishedPostsForCoverage(),
    getActivePredefinedSkills(),
    findPublishedThemes(),
  ]);
  return computeSeedCoverage({
    posts: posts.map((post) => ({
      type: post.type,
      skills: post.skills.map((row) => row.skill.slug),
      themes: post.themePosts.map((row) => row.theme.slug),
    })),
    skills,
    themes,
  });
}
