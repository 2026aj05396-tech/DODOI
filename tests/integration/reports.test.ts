import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getActor } from "@/server/auth";
import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";
import { getProfile } from "@/server/modules/library";
import { actOnReport, createReport, listReportGroups } from "@/server/modules/reports";
import { listSkills } from "@/server/modules/skills";

import * as reportsRoute from "../../src/app/api/reports/route";
import { resetDatabase } from "../helpers/database";
import { actorFor, createCreator, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Reports (roadmap P1-28b; RPT-01…05): verified users report custom skills and profiles; admins
// see one group per target and hide, dismiss or restore it; every action audited.

vi.mock("@/server/auth", () => ({ getActor: vi.fn() }));
const mockedGetActor = vi.mocked(getActor);
const options = { provider: createFakeMediaProvider() };

async function member(): Promise<AuthenticatedActor> {
  return actorFor(await createCreator());
}

async function admin(): Promise<AuthenticatedActor> {
  return actorFor(await createUser(), "ADMIN");
}

async function usernameOf(actor: AuthenticatedActor): Promise<string> {
  return (await db.profile.findUniqueOrThrow({ where: { userId: actor.id } })).username;
}

describe("reports", () => {
  beforeEach(async () => {
    await resetDatabase();
    mockedGetActor.mockReset();
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it("groups reports by target; hiding a profile resolves them all and hides it from others", async () => {
    const target = await member();
    const [first, second, visitor] = [await member(), await member(), await member()];
    const username = await usernameOf(target);

    await createReport(first, { targetType: "PROFILE", targetId: username, reason: "SPAM" });
    await createReport(first, { targetType: "PROFILE", targetId: username, reason: "SPAM" });
    await createReport(second, {
      targetType: "PROFILE",
      targetId: username,
      reason: "IMPERSONATION",
      note: "Pretends to be a famous potter.",
    });

    const staff = await admin();
    const open = await listReportGroups(staff, { status: "OPEN" });
    expect(open.items).toHaveLength(1);
    expect(open.items[0]).toMatchObject({
      targetType: "PROFILE",
      reportCount: 2,
      reasons: { SPAM: 1, IMPERSONATION: 1 },
      notes: [{ reason: "IMPERSONATION", note: "Pretends to be a famous potter." }],
      target: { detail: `@${username}`, isHidden: false },
    });
    expect(JSON.stringify(open.items)).not.toContain(first.id);

    await actOnReport(staff, open.items[0]?.reportId ?? "", { action: "HIDE_TARGET" });

    expect((await listReportGroups(staff, { status: "OPEN" })).items).toEqual([]);
    const resolved = await listReportGroups(staff, { status: "RESOLVED" });
    expect(resolved.items[0]).toMatchObject({ status: "ACTIONED", target: { isHidden: true } });
    await expect(getProfile(visitor, username, options)).rejects.toMatchObject({ status: 404 });
    expect(await getProfile(target, username, options)).toMatchObject({ isHidden: true });
    expect(
      await db.auditLog.count({ where: { action: "report.hide_target", targetId: target.id } }),
    ).toBe(1);

    await actOnReport(staff, resolved.items[0]?.reportId ?? "", { action: "RESTORE_TARGET" });
    await expect(getProfile(visitor, username, options)).resolves.toMatchObject({
      isPrivate: false,
    });
  });

  it("hides a reported custom skill; dismissing leaves a target visible", async () => {
    const reporter = await member();
    const staff = await admin();
    const custom = await createSkill("Lippan mirror work", { origin: "CUSTOM" });
    const other = await createSkill("Mud art", { origin: "CUSTOM" });

    await createReport(reporter, { targetType: "SKILL", targetId: custom.id, reason: "OFFENSIVE" });
    await createReport(reporter, { targetType: "SKILL", targetId: other.id, reason: "OTHER" });
    const groups = (await listReportGroups(staff, { status: "OPEN" })).items;
    const forCustom = groups.find((group) => group.target.label === "Lippan mirror work");
    const forOther = groups.find((group) => group.target.label === "Mud art");

    await actOnReport(staff, forCustom?.reportId ?? "", { action: "HIDE_TARGET" });
    await actOnReport(staff, forOther?.reportId ?? "", { action: "DISMISS" });

    const names = (await listSkills(reporter, { limit: 50 })).items.map((skill) => skill.name);
    expect(names).not.toContain("Lippan mirror work");
    expect(names).toContain("Mud art");
    expect(
      await db.report.findMany({ select: { status: true }, orderBy: { createdAt: "asc" } }),
    ).toEqual([{ status: "ACTIONED" }, { status: "DISMISSED" }]);
  });

  it("refuses unverified reporters, self-reports and predefined skills; limits 10 a day", async () => {
    const unverified = actorFor(await createUser({ emailVerified: null }));
    const reporter = await member();
    const predefined = await createSkill("Crochet");

    await expect(
      createReport(unverified, { targetType: "SKILL", targetId: predefined.id, reason: "SPAM" }),
    ).rejects.toMatchObject({ status: 403, code: "EMAIL_NOT_VERIFIED" });
    await expect(
      createReport(reporter, {
        targetType: "PROFILE",
        targetId: await usernameOf(reporter),
        reason: "SPAM",
      }),
    ).rejects.toMatchObject({ status: 422, code: "SELF_REPORT" });
    await expect(
      createReport(reporter, { targetType: "SKILL", targetId: predefined.id, reason: "SPAM" }),
    ).rejects.toMatchObject({ status: 400, code: "NOT_REPORTABLE" });

    for (let index = 0; index < 10; index += 1) {
      const skill = await createSkill(`Custom ${index}`, { origin: "CUSTOM" });
      await createReport(reporter, { targetType: "SKILL", targetId: skill.id, reason: "SPAM" });
    }
    const eleventh = await createSkill("Custom 11", { origin: "CUSTOM" });
    await expect(
      createReport(reporter, { targetType: "SKILL", targetId: eleventh.id, reason: "SPAM" }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("keeps admin endpoints hidden from others; the report route answers 201", async () => {
    const reporter = await member();
    const target = await member();
    await expect(listReportGroups(reporter, { status: "OPEN" })).rejects.toMatchObject({
      status: 404,
    });

    mockedGetActor.mockResolvedValue(reporter);
    const response = await reportsRoute.POST(
      new NextRequest("http://localhost:3000/api/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          targetType: "PROFILE",
          targetId: await usernameOf(target),
          reason: "OTHER",
        }),
      }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(201);
  });
});
