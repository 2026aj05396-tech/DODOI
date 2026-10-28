// Minimum seed content for launch (OD-31, PO decision 2026-10-28: tiered). Read by the seed
// importer's coverage report (`pnpm seed:content --check`) and the admin Coverage page.

export const SEED_MINIMUMS = {
  /** Published posts tagged with each active predefined skill. */
  postsPerSkill: 2,
  /** Published posts tagged with each launch-focus skill. */
  postsPerFocusSkill: 6,
  /** Published tutorials among them. */
  tutorialsPerFocusSkill: 2,
  /** Published posts of each post type. */
  postsPerType: 5,
  /** Published posts in each published theme. */
  postsPerTheme: 6,
} as const;

/** The crafts the design and landing lead with, plus the most common beginner picks (PO, OD-31). */
export const LAUNCH_FOCUS_SKILLS = [
  "drawing",
  "sketching",
  "doodling",
  "watercolor",
  "acrylic-painting",
  "calligraphy",
  "crochet",
  "amigurumi",
  "knitting",
  "embroidery",
  "punch-needle",
  "pottery",
  "polymer-clay",
  "origami",
  "journaling",
] as const;
