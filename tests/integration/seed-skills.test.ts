import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { seedPredefinedSkills, type PredefinedSkillsData } from "@/server/modules/skills";

import seed from "../../prisma/seed/skills.json";
import { resetDatabase } from "../helpers/database";
import { createSkill } from "../helpers/factories";

const data = seed as PredefinedSkillsData;

describe("seedPredefinedSkills", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  it("loads every skill and both directions of each related pair", async () => {
    const result = await seedPredefinedSkills(data);

    expect(result).toEqual({
      created: data.skills.length,
      updated: 0,
      relations: data.relatedPairs.length * 2,
    });
    expect(await db.skill.count({ where: { origin: "PREDEFINED" } })).toBe(data.skills.length);
  });

  it("is idempotent: a second run adds no skills or relations", async () => {
    await seedPredefinedSkills(data);

    const second = await seedPredefinedSkills(data);

    expect(second).toEqual({ created: 0, updated: data.skills.length, relations: 0 });
    expect(await db.skill.count()).toBe(data.skills.length);
    expect(await db.skillRelation.count()).toBe(data.relatedPairs.length * 2);
  });

  it("turns a matching custom interest into the official skill, keeping its slug", async () => {
    const custom = await createSkill("crochet", { origin: "CUSTOM" });

    await seedPredefinedSkills(data);

    const skill = await db.skill.findUniqueOrThrow({ where: { id: custom.id } });
    expect(skill).toMatchObject({ origin: "PREDEFINED", name: "Crochet", slug: custom.slug });
    expect(skill.pitch).toBeTruthy();
  });

  it("does not un-hide a skill an admin has hidden", async () => {
    await seedPredefinedSkills(data);
    await db.skill.update({ where: { slug: "crochet" }, data: { status: "HIDDEN" } });

    await seedPredefinedSkills(data);

    expect((await db.skill.findUniqueOrThrow({ where: { slug: "crochet" } })).status).toBe(
      "HIDDEN",
    );
  });

  it("rejects data whose slug does not match the name", async () => {
    const [first] = data.skills;
    if (!first) throw new Error("skills.json is empty");
    const broken: PredefinedSkillsData = {
      skills: [{ ...first, slug: "wrong-slug" }],
      relatedPairs: [],
    };

    await expect(seedPredefinedSkills(broken)).rejects.toThrow(/Invalid predefined skill/);
    expect(await db.skill.count()).toBe(0);
  });
});
