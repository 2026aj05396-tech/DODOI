import { LAUNCH_FOCUS_SKILLS, SEED_MINIMUMS } from "@/lib/constants/seed-coverage";
import type { PostTypeName } from "@/lib/types/posts";
import type { SeedCoverage, SkillCoverage } from "@/lib/types/seed-coverage";

// Counts seed content against the OD-31 minimums (P1-19). Pure, so the importer can run it on
// seed files and the admin page on published posts. A post counts toward every skill it is
// tagged with; only active predefined skills and published themes need content.

export const POST_TYPES: PostTypeName[] = [
  "FIRST_ATTEMPT",
  "TUTORIAL",
  "WORK_IN_PROGRESS",
  "JOURNAL",
  "FINISHED",
  "TIP",
];

export type CoveragePost = { type: PostTypeName; skills: string[]; themes: string[] };

export type CoverageInput = {
  /** Published posts (or seed files that will publish). */
  posts: CoveragePost[];
  /** Active predefined skills. */
  skills: { slug: string; name: string }[];
  /** Published themes, or `null` when unknown. */
  themes: { slug: string; title: string }[] | null;
};

const FOCUS = new Set<string>(LAUNCH_FOCUS_SKILLS);

export function computeSeedCoverage({ posts, skills, themes }: CoverageInput): SeedCoverage {
  const postsBySkill = new Map<string, number>();
  const tutorialsBySkill = new Map<string, number>();
  const postsByType = new Map<PostTypeName, number>();
  const postsByTheme = new Map<string, number>();
  const bump = <K>(map: Map<K, number>, key: K) => map.set(key, (map.get(key) ?? 0) + 1);

  for (const post of posts) {
    bump(postsByType, post.type);
    for (const skill of new Set(post.skills)) {
      bump(postsBySkill, skill);
      if (post.type === "TUTORIAL") bump(tutorialsBySkill, skill);
    }
    for (const theme of new Set(post.themes)) bump(postsByTheme, theme);
  }

  const skillRows: SkillCoverage[] = skills.map(({ slug, name }) => {
    const focus = FOCUS.has(slug);
    const minPosts = focus ? SEED_MINIMUMS.postsPerFocusSkill : SEED_MINIMUMS.postsPerSkill;
    const minTutorials = focus ? SEED_MINIMUMS.tutorialsPerFocusSkill : 0;
    const count = postsBySkill.get(slug) ?? 0;
    const tutorials = tutorialsBySkill.get(slug) ?? 0;
    return {
      slug,
      name,
      focus,
      posts: count,
      tutorials,
      minPosts,
      minTutorials,
      met: count >= minPosts && tutorials >= minTutorials,
    };
  });
  skillRows.sort((a, b) => Number(b.focus) - Number(a.focus) || a.name.localeCompare(b.name));

  const types = POST_TYPES.map((type) => {
    const count = postsByType.get(type) ?? 0;
    return {
      type,
      posts: count,
      min: SEED_MINIMUMS.postsPerType,
      met: count >= SEED_MINIMUMS.postsPerType,
    };
  });

  const themeRows =
    themes?.map(({ slug, title }) => {
      const count = postsByTheme.get(slug) ?? 0;
      return {
        slug,
        title,
        posts: count,
        min: SEED_MINIMUMS.postsPerTheme,
        met: count >= SEED_MINIMUMS.postsPerTheme,
      };
    }) ?? null;

  const known = new Set(skills.map((skill) => skill.slug));
  const missingFocusSkills = LAUNCH_FOCUS_SKILLS.filter((slug) => !known.has(slug));
  const unmet = (rows: { met: boolean }[]) => rows.filter((row) => !row.met).length;

  return {
    skills: skillRows,
    types,
    themes: themeRows,
    missingFocusSkills,
    gaps: unmet(skillRows) + unmet(types) + unmet(themeRows ?? []) + missingFocusSkills.length,
  };
}
