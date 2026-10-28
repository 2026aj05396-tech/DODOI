import { describe, expect, it } from "vitest";

import { LAUNCH_FOCUS_SKILLS, SEED_MINIMUMS } from "@/lib/constants/seed-coverage";
import type { PostTypeName } from "@/lib/types/posts";

import { computeSeedCoverage, POST_TYPES, type CoveragePost } from "./seed-coverage";

const ALL_FOCUS = LAUNCH_FOCUS_SKILLS.map((slug) => ({ slug, name: slug }));
const post = (type: PostTypeName, skills: string[], themes: string[] = []): CoveragePost => ({
  type,
  skills,
  themes,
});
const times = (n: number, make: () => CoveragePost) => Array.from({ length: n }, make);

describe("computeSeedCoverage", () => {
  it("needs 2 posts for an ordinary skill and 6 with 2 tutorials for a focus skill", () => {
    const coverage = computeSeedCoverage({
      posts: [
        ...times(2, () => post("TIP", ["origami-boxes"])),
        ...times(5, () => post("TIP", ["crochet"])),
        post("TUTORIAL", ["crochet"]),
      ],
      skills: [...ALL_FOCUS, { slug: "origami-boxes", name: "Origami boxes" }],
      themes: null,
    });

    const ordinary = coverage.skills.find((row) => row.slug === "origami-boxes");
    const crochet = coverage.skills.find((row) => row.slug === "crochet");
    expect(ordinary).toMatchObject({ focus: false, posts: 2, minPosts: 2, met: true });
    // Six posts, but only one tutorial.
    expect(crochet).toMatchObject({
      focus: true,
      posts: 6,
      tutorials: 1,
      minTutorials: 2,
      met: false,
    });
  });

  it("counts a post toward every skill it is tagged with, once each", () => {
    const coverage = computeSeedCoverage({
      posts: [post("TIP", ["drawing", "doodling", "drawing"])],
      skills: ALL_FOCUS,
      themes: null,
    });
    const count = (slug: string) => coverage.skills.find((row) => row.slug === slug)?.posts;
    expect(count("drawing")).toBe(1);
    expect(count("doodling")).toBe(1);
  });

  it("checks every post type and, when known, every theme", () => {
    const coverage = computeSeedCoverage({
      posts: [
        ...times(SEED_MINIMUMS.postsPerType, () => post("TIP", ["drawing"], ["rainy-day"])),
        post("JOURNAL", ["drawing"], ["rainy-day"]),
      ],
      skills: ALL_FOCUS,
      themes: [
        { slug: "rainy-day", title: "Rainy day" },
        { slug: "gifts", title: "Gifts" },
      ],
    });

    expect(coverage.types.map((row) => row.type)).toEqual(POST_TYPES);
    expect(coverage.types.find((row) => row.type === "TIP")?.met).toBe(true);
    expect(coverage.types.find((row) => row.type === "JOURNAL")).toMatchObject({
      posts: 1,
      met: false,
    });
    expect(coverage.themes).toEqual([
      { slug: "rainy-day", title: "Rainy day", posts: 6, min: 6, met: true },
      { slug: "gifts", title: "Gifts", posts: 0, min: 6, met: false },
    ]);
  });

  it("lists focus skills first and reports focus skills that don't exist as gaps", () => {
    const coverage = computeSeedCoverage({
      posts: [],
      skills: [
        { slug: "weaving", name: "Weaving" },
        { slug: "crochet", name: "Crochet" },
      ],
      themes: null,
    });

    expect(coverage.skills.map((row) => row.slug)).toEqual(["crochet", "weaving"]);
    expect(coverage.missingFocusSkills).toHaveLength(LAUNCH_FOCUS_SKILLS.length - 1);
    expect(coverage.themes).toBeNull();
    // 2 skills + 6 types below minimum, plus 14 missing focus skills.
    expect(coverage.gaps).toBe(2 + POST_TYPES.length + LAUNCH_FOCUS_SKILLS.length - 1);
  });

  it("reports no gaps when every minimum is met", () => {
    const skills = [...ALL_FOCUS, { slug: "weaving", name: "Weaving" }];
    const posts = [
      ...skills.flatMap(({ slug }) => times(2, () => post("TUTORIAL", [slug]))),
      ...LAUNCH_FOCUS_SKILLS.flatMap((slug) => times(4, () => post("TIP", [slug]))),
      ...POST_TYPES.flatMap((type) => times(5, () => post(type, ["weaving"]))),
    ];
    expect(computeSeedCoverage({ posts, skills, themes: [] }).gaps).toBe(0);
  });
});
