import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { getSkillBySlug, listSkills, resolveCustomSkill } from "@/server/modules/skills";

import { resetDatabase } from "../helpers/database";
import { actorFor, createSkill, createUser } from "../helpers/factories";

const neverBlocked = { isBlocked: () => false };

describe("skills module", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  describe("resolveCustomSkill", () => {
    it('resolves " Crochet " to the existing Crochet skill instead of creating a duplicate', async () => {
      const crochet = await createSkill("Crochet");
      const actor = actorFor(await createUser());

      const result = await resolveCustomSkill(actor, { name: "  crochet " }, neverBlocked);

      expect(result).toMatchObject({ created: false, skill: { id: crochet.id, name: "Crochet" } });
      expect(await db.skill.count()).toBe(1);
    });

    it("creates a public custom skill with the user's casing, a slug and an accent", async () => {
      const user = await createUser();

      const result = await resolveCustomSkill(
        actorFor(user),
        { name: " Pipe cleaner  animals " },
        neverBlocked,
      );

      expect(result.created).toBe(true);
      expect(result.skill).toMatchObject({
        name: "Pipe cleaner animals",
        slug: "pipe-cleaner-animals",
        origin: "CUSTOM",
      });
      const stored = await db.skill.findUniqueOrThrow({ where: { id: result.skill.id } });
      expect(stored).toMatchObject({
        createdById: user.id,
        status: "ACTIVE",
        normalizedName: "pipe cleaner animals",
      });
    });

    it("gives a new skill a unique slug when the plain slug is taken", async () => {
      await createSkill("Arts crafts");
      const actor = actorFor(await createUser());

      const result = await resolveCustomSkill(actor, { name: "Arts & crafts" }, neverBlocked);

      expect(result.skill.slug).toBe("arts-crafts-2");
    });

    it("creates exactly one skill when two users add the same name at the same moment", async () => {
      const [first, second] = await Promise.all([createUser(), createUser()]);

      const results = await Promise.all([
        resolveCustomSkill(actorFor(first), { name: "Punch needle" }, neverBlocked),
        resolveCustomSkill(actorFor(second), { name: "punch needle" }, neverBlocked),
      ]);

      expect(await db.skill.count()).toBe(1);
      expect(results.filter((result) => result.created)).toHaveLength(1);
      expect(results[0]?.skill.id).toBe(results[1]?.skill.id);
    });

    it("rejects blocked names with SKILL_NAME_NOT_ALLOWED", async () => {
      const actor = actorFor(await createUser());

      await expect(
        resolveCustomSkill(
          actor,
          { name: "Badword knitting" },
          { isBlocked: (name) => name.includes("Badword") },
        ),
      ).rejects.toMatchObject({ status: 400, code: "SKILL_NAME_NOT_ALLOWED" });
      expect(await db.skill.count()).toBe(0);
    });

    it("does not bring back a skill an admin has hidden", async () => {
      await createSkill("Hidden craft", { status: "HIDDEN", origin: "CUSTOM" });
      const actor = actorFor(await createUser());

      await expect(
        resolveCustomSkill(actor, { name: "hidden craft" }, neverBlocked),
      ).rejects.toMatchObject({
        code: "SKILL_NAME_NOT_ALLOWED",
      });
    });

    it("rejects names with disallowed characters", async () => {
      const actor = actorFor(await createUser());

      await expect(
        resolveCustomSkill(actor, { name: "Knitting 🧶" }, neverBlocked),
      ).rejects.toMatchObject({
        status: 400,
        code: "VALIDATION_ERROR",
      });
    });

    it("requires a verified email (403 EMAIL_NOT_VERIFIED) and a signed-in user (401)", async () => {
      const unverified = actorFor(await createUser({ emailVerified: null }));

      await expect(
        resolveCustomSkill(unverified, { name: "Felting" }, neverBlocked),
      ).rejects.toMatchObject({
        status: 403,
        code: "EMAIL_NOT_VERIFIED",
      });
      await expect(
        resolveCustomSkill(null, { name: "Felting" }, neverBlocked),
      ).rejects.toMatchObject({
        status: 401,
      });
    });

    it("limits a user to 10 new custom skills per day (429), while reusing existing ones stays free", async () => {
      const actor = actorFor(await createUser());
      for (let index = 1; index <= 10; index++) {
        await resolveCustomSkill(
          actor,
          { name: `Craft number ${"x".repeat(index)}` },
          neverBlocked,
        );
      }

      await expect(
        resolveCustomSkill(actor, { name: "One too many" }, neverBlocked),
      ).rejects.toMatchObject({
        status: 429,
      });
      const reuse = await resolveCustomSkill(actor, { name: "craft number x" }, neverBlocked);
      expect(reuse.created).toBe(false);
    });
  });

  describe("listSkills", () => {
    it("lists only active skills alphabetically, page by page", async () => {
      for (const name of ["Crochet", "Drawing", "Embroidery", "Felting"]) await createSkill(name);
      await createSkill("Hidden", { status: "HIDDEN" });
      const actor = actorFor(await createUser());

      const first = await listSkills(actor, { limit: 3 });
      const second = await listSkills(actor, { limit: 3, cursor: first.nextCursor ?? undefined });

      expect(first.items.map((skill) => skill.name)).toEqual(["Crochet", "Drawing", "Embroidery"]);
      expect(second.items.map((skill) => skill.name)).toEqual(["Felting"]);
      expect(second.nextCursor).toBeNull();
    });

    it("finds skills by partial keyword and by misspelling, prefix matches first", async () => {
      for (const name of ["Crochet", "Cross-stitch", "Watercolor"]) await createSkill(name);
      const actor = actorFor(await createUser());

      const partial = await listSkills(actor, { q: "croch", limit: 10 });
      const typo = await listSkills(actor, { q: "watercolour", limit: 10 });

      expect(partial.items[0]?.name).toBe("Crochet");
      expect(typo.items.map((skill) => skill.name)).toContain("Watercolor");
    });

    it("filters by origin so custom interests are discoverable on their own", async () => {
      await createSkill("Crochet");
      await createSkill("Pipe cleaner animals", { origin: "CUSTOM" });
      const actor = actorFor(await createUser());

      const custom = await listSkills(actor, { origin: "CUSTOM", limit: 10 });

      expect(custom.items.map((skill) => skill.name)).toEqual(["Pipe cleaner animals"]);
    });

    it("requires a signed-in user", async () => {
      await expect(listSkills(null, { limit: 10 })).rejects.toMatchObject({ status: 401 });
    });
  });

  describe("getSkillBySlug", () => {
    it("returns the skill with its active related skills", async () => {
      const crochet = await createSkill("Crochet");
      const felting = await createSkill("Felting");
      const hidden = await createSkill("Secret", { status: "HIDDEN" });
      await db.skillRelation.createMany({
        data: [
          { fromSkillId: crochet.id, toSkillId: felting.id },
          { fromSkillId: crochet.id, toSkillId: hidden.id },
        ],
      });
      const actor = actorFor(await createUser());

      const detail = await getSkillBySlug(actor, "crochet");

      expect(detail.name).toBe("Crochet");
      expect(detail.relatedSkills.map((skill) => skill.name)).toEqual(["Felting"]);
    });

    it("returns 404 for hidden or unknown skills", async () => {
      await createSkill("Secret", { status: "HIDDEN" });
      const actor = actorFor(await createUser());

      await expect(getSkillBySlug(actor, "secret")).rejects.toMatchObject({ status: 404 });
      await expect(getSkillBySlug(actor, "nope")).rejects.toMatchObject({ status: 404 });
    });
  });
});
