import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getActor } from "@/server/auth";
import { db } from "@/server/db/client";
import {
  completeOnboarding,
  getMySkills,
  getOnboardingState,
  replaceMySkills,
  setOnboardingStep,
} from "@/server/modules/users";

import * as completeRoute from "../../src/app/api/me/onboarding/complete/route";
import * as skillsRoute from "../../src/app/api/me/skills/route";
import { resetDatabase } from "../helpers/database";
import { actorFor, createSkill, createUser } from "../helpers/factories";

// The signed-in user's skills and onboarding (roadmap P1-10, API_SPECIFICATION §4).

vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
const mockedGetActor = vi.mocked(getActor);

const interest = (skillId: string) => ({ skillId, isInterest: true });

async function threeSkills() {
  return Promise.all([createSkill("Crochet"), createSkill("Clay"), createSkill("Sketching")]);
}

describe("user skills and onboarding", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGetActor.mockResolvedValue(null);
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  describe("replaceMySkills", () => {
    it("replaces the whole set, keeps flags and levels, and drops rows with no flag", async () => {
      const user = await createUser();
      const [crochet, clay, sketching] = await threeSkills();
      await replaceMySkills(actorFor(user), {
        items: [
          { ...interest(crochet.id), level: "BEGINNER", canHelp: false, wantsToLearn: false },
        ],
      });

      const result = await replaceMySkills(actorFor(user), {
        items: [
          {
            skillId: clay.id,
            isInterest: true,
            canHelp: true,
            wantsToLearn: false,
            level: "EXPERIENCED",
          },
          {
            skillId: sketching.id,
            isInterest: false,
            canHelp: false,
            wantsToLearn: false,
            level: null,
          },
        ],
      });

      expect(result.items).toEqual([
        {
          skill: expect.objectContaining({ id: clay.id, name: "Clay" }),
          isInterest: true,
          canHelp: true,
          wantsToLearn: false,
          level: "EXPERIENCED",
        },
      ]);
      expect(await db.userSkill.count()).toBe(1);
    });

    it("only ever changes the signed-in user's own skills", async () => {
      const [owner, other] = await Promise.all([createUser(), createUser()]);
      const [crochet, clay] = await threeSkills();
      await replaceMySkills(actorFor(other), {
        items: [{ ...interest(clay.id), canHelp: false, wantsToLearn: false, level: null }],
      });

      await replaceMySkills(actorFor(owner), {
        items: [{ ...interest(crochet.id), canHelp: false, wantsToLearn: false, level: null }],
      });

      expect((await getMySkills(actorFor(other))).items.map((item) => item.skill.name)).toEqual([
        "Clay",
      ]);
      expect((await getMySkills(actorFor(owner))).items.map((item) => item.skill.name)).toEqual([
        "Crochet",
      ]);
    });

    it("rejects hidden or unknown skills on their item field", async () => {
      const user = await createUser();
      const hidden = await createSkill("Hidden thing", { status: "HIDDEN" });

      await expect(
        replaceMySkills(actorFor(user), {
          items: [{ ...interest(hidden.id), canHelp: false, wantsToLearn: false, level: null }],
        }),
      ).rejects.toMatchObject({
        status: 400,
        code: "SKILL_NOT_AVAILABLE",
        fields: { "items.0.skillId": "This skill isn't available any more." },
      });
    });

    it("leaves out skills hidden after they were added", async () => {
      const user = await createUser();
      const [crochet, clay] = await threeSkills();
      await replaceMySkills(actorFor(user), {
        items: [crochet, clay].map((skill) => ({
          ...interest(skill.id),
          canHelp: false,
          wantsToLearn: false,
          level: null,
        })),
      });
      await db.skill.update({ where: { id: clay.id }, data: { status: "HIDDEN" } });

      expect((await getMySkills(actorFor(user))).items.map((item) => item.skill.name)).toEqual([
        "Crochet",
      ]);
    });
  });

  describe("onboarding", () => {
    it("starts at step 1, not completed", async () => {
      const user = await createUser();

      expect(await getOnboardingState(actorFor(user))).toEqual({
        step: 1,
        completed: false,
        interestCount: 0,
      });
    });

    it("refuses steps 2 and 3, and completion, with fewer than 3 interests", async () => {
      const user = await createUser();
      const [crochet, clay] = await threeSkills();
      await replaceMySkills(actorFor(user), {
        items: [crochet, clay].map((skill) => ({
          ...interest(skill.id),
          canHelp: false,
          wantsToLearn: false,
          level: null,
        })),
      });

      const notEnough = { status: 422, code: "NOT_ENOUGH_INTERESTS" };
      await expect(setOnboardingStep(actorFor(user), { step: 2 })).rejects.toMatchObject(notEnough);
      await expect(completeOnboarding(actorFor(user))).rejects.toMatchObject(notEnough);
    });

    it("saves the step to resume at and completes once with 3 interests", async () => {
      const user = await createUser();
      const skills = await threeSkills();
      await replaceMySkills(actorFor(user), {
        items: skills.map((skill) => ({
          ...interest(skill.id),
          canHelp: false,
          wantsToLearn: false,
          level: null,
        })),
      });

      expect(await setOnboardingStep(actorFor(user), { step: 3 })).toMatchObject({
        step: 3,
        interestCount: 3,
      });
      await completeOnboarding(actorFor(user));
      const first = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      await completeOnboarding(actorFor(user));
      const second = await db.user.findUniqueOrThrow({ where: { id: user.id } });

      expect(await getOnboardingState(actorFor(user))).toMatchObject({ completed: true });
      expect(second.onboardingCompletedAt).toEqual(first.onboardingCompletedAt);
    });

    it("does not count hidden skills towards the 3 interests", async () => {
      const user = await createUser();
      const skills = await threeSkills();
      await replaceMySkills(actorFor(user), {
        items: skills.map((skill) => ({
          ...interest(skill.id),
          canHelp: false,
          wantsToLearn: false,
          level: null,
        })),
      });
      await db.skill.update({ where: { id: skills[0]?.id }, data: { status: "HIDDEN" } });

      await expect(completeOnboarding(actorFor(user))).rejects.toMatchObject({
        code: "NOT_ENOUGH_INTERESTS",
      });
    });
  });

  describe("routes", () => {
    const ORIGIN = "http://localhost:3000";
    const noParams = { params: Promise.resolve({}) };
    const put = (body: unknown) =>
      new NextRequest(`${ORIGIN}/api/me/skills`, {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json", origin: ORIGIN, host: "localhost:3000" },
      });

    it("answers 401 when signed out", async () => {
      expect(
        (await skillsRoute.GET(new NextRequest(`${ORIGIN}/api/me/skills`), noParams)).status,
      ).toBe(401);
    });

    it("validates the body: at most 50 items and no duplicate skills", async () => {
      mockedGetActor.mockResolvedValue(actorFor(await createUser()));
      const crochet = await createSkill("Crochet");

      const tooMany = await skillsRoute.PUT(
        put({
          items: Array.from({ length: 51 }, (_, index) => ({
            skillId: `s${index}`,
            isInterest: true,
          })),
        }),
        noParams,
      );
      const duplicate = await skillsRoute.PUT(
        put({ items: [interest(crochet.id), interest(crochet.id)] }),
        noParams,
      );

      expect(tooMany.status).toBe(400);
      expect(duplicate.status).toBe(400);
      expect((await duplicate.json()) as unknown).toMatchObject({
        error: { fields: { items: "Each skill can only appear once." } },
      });
    });

    it("saves through PUT and completes onboarding through POST", async () => {
      const user = await createUser();
      mockedGetActor.mockResolvedValue(actorFor(user));
      const skills = await threeSkills();

      const saved = await skillsRoute.PUT(
        put({ items: skills.map((skill) => interest(skill.id)) }),
        noParams,
      );
      const complete = await completeRoute.POST(
        new NextRequest(`${ORIGIN}/api/me/onboarding/complete`, {
          method: "POST",
          headers: { origin: ORIGIN, host: "localhost:3000" },
        }),
        noParams,
      );

      expect(saved.status).toBe(200);
      expect(complete.status).toBe(204);
    });
  });
});
