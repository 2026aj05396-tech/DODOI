import { describe, expect, it } from "vitest";

import {
  diversify,
  freshnessPoints,
  isDiscovery,
  levelFits,
  rankPage,
  scoreCandidate,
  type RankCandidate,
  type RankingContext,
} from "./ranking";

// One test per ranking rule (roadmap P1-21, SYSTEM_ARCHITECTURE §7).

const NOW = new Date("2026-10-26T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

function post(id: string, overrides: Partial<RankCandidate> = {}): RankCandidate {
  return {
    id,
    authorId: null,
    publishedAt: daysAgo(60),
    difficulty: null,
    skillIds: ["crochet"],
    primarySkillId: "crochet",
    ...overrides,
  };
}

function context(overrides: Partial<RankingContext> = {}): RankingContext {
  return {
    interests: new Set(["crochet", "embroidery"]),
    levels: new Map(),
    followedAuthors: new Set(),
    savedSkills: new Set(),
    notInterestedSkills: new Set(),
    now: NOW,
    ...overrides,
  };
}

describe("feed ranking", () => {
  it("adds 4 for a post by a maker the user follows (FLW-04)", () => {
    const theirs = post("a", {
      authorId: "maker",
      skillIds: ["pottery"],
      primarySkillId: "pottery",
    });
    const other = post("b", {
      authorId: "someone",
      skillIds: ["pottery"],
      primarySkillId: "pottery",
    });
    const followed = context({ followedAuthors: new Set(["maker"]) });
    expect(scoreCandidate(theirs, followed, "full")).toBe(4);
    expect(scoreCandidate(other, followed, "full")).toBe(0);
    expect(scoreCandidate(post("c"), followed, "full")).toBe(3);
  });

  it("adds 3 per post skill among the user's interests", () => {
    const both = post("a", { skillIds: ["crochet", "embroidery"] });
    const none = post("b", { skillIds: ["pottery"], primarySkillId: "pottery" });
    expect(scoreCandidate(both, context(), "full")).toBe(6);
    expect(scoreCandidate(none, context(), "full")).toBe(0);
  });

  it("fits posts at most one level above the user's level, Curious when none is given", () => {
    const beginner = post("a", { difficulty: "BEGINNER" });
    const intermediate = post("b", { difficulty: "INTERMEDIATE" });
    expect(levelFits(beginner, context())).toBe(true);
    expect(levelFits(intermediate, context())).toBe(false);
    expect(levelFits(intermediate, context({ levels: new Map([["crochet", "BEGINNER"]]) }))).toBe(
      true,
    );
    expect(levelFits(post("c"), context())).toBe(false);
  });

  it("gives +2 under 7 days, +1 under 30 days, nothing after", () => {
    expect(freshnessPoints(daysAgo(2), NOW)).toBe(2);
    expect(freshnessPoints(daysAgo(10), NOW)).toBe(1);
    expect(freshnessPoints(daysAgo(40), NOW)).toBe(0);
  });

  it("adds save affinity and subtracts 2 per skill marked Not interested", () => {
    const candidate = post("a", { skillIds: ["pottery"], primarySkillId: "pottery" });
    expect(scoreCandidate(candidate, context({ savedSkills: new Set(["pottery"]) }), "full")).toBe(
      1,
    );
    expect(
      scoreCandidate(candidate, context({ notInterestedSkills: new Set(["pottery"]) }), "full"),
    ).toBe(-2);
  });

  it("ranks New to you by freshness and level fit only", () => {
    const candidate = post("a", { publishedAt: daysAgo(1), difficulty: "CURIOUS" });
    expect(scoreCandidate(candidate, context(), "newToYou")).toBe(3);
  });

  it("never puts more than 2 posts with the same main skill in a row", () => {
    const items = ["c", "c", "c", "p", "c"].map((skill, index) => ({
      id: `${index}`,
      primarySkillId: skill,
    }));
    expect(diversify(items).map((item) => item.primarySkillId)).toEqual(["c", "c", "p", "c", "c"]);
  });

  it("fills at least 20% of a For you page from outside the user's interests", () => {
    const interest = Array.from({ length: 10 }, (_, index) =>
      post(`i${index}`, {
        publishedAt: daysAgo(index),
        skillIds: [index % 2 ? "crochet" : "embroidery"],
        primarySkillId: index % 2 ? "crochet" : "embroidery",
      }),
    );
    const discovery = [1, 2, 3].map((index) =>
      post(`d${index}`, { skillIds: ["pottery"], primarySkillId: `pottery-${index}` }),
    );
    const page = rankPage([...interest, ...discovery], context(), {
      limit: 10,
      mode: "full",
      discoveryQuota: true,
    });

    expect(page).toHaveLength(10);
    expect(page.filter((item) => isDiscovery(item, context().interests))).toHaveLength(2);
    // The lowest-ranked interest posts made room.
    expect(page.map((item) => item.id)).not.toContain("i9");
    expect(page.map((item) => item.id)).not.toContain("i8");
  });

  it("skips the quota for skill chips", () => {
    const interest = Array.from({ length: 5 }, (_, index) => post(`i${index}`));
    const discovery = post("d", { skillIds: ["pottery"], primarySkillId: "pottery" });
    const page = rankPage([...interest, discovery], context(), {
      limit: 5,
      mode: "full",
      discoveryQuota: false,
    });
    expect(page.map((item) => item.id)).not.toContain("d");
  });
});
