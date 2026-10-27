import "server-only";

import { z } from "zod";

import type {
  AdminReportsQuery,
  CreateReportInput,
  ReportActionInput,
  ReportReason,
} from "@/lib/schemas/reports";
import type { Paginated } from "@/lib/types/api";
import type { ReportGroup } from "@/lib/types/reports";
import { requireAdmin, type Actor, type AuthenticatedActor } from "@/server/lib/actor";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
  ValidationError,
} from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";
import { recordAudit } from "@/server/modules/admin";
import { getSkillsForModeration, setSkillHidden } from "@/server/modules/skills";
import {
  getProfilesForModeration,
  getUserIdByUsername,
  setProfileHidden,
} from "@/server/modules/users";

import {
  findOpenReport,
  findReport,
  findReportedTargets,
  findReportsForTargets,
  insertReport,
  resolveOpenReports,
} from "./repository";

// Reports (RPT-01…05, API_SPECIFICATION §6b). Verified users report custom skills and profiles;
// admins see one row per reported target (PO decision, P1-28b) and hide it, dismiss its reports,
// or show it again later. Reporters are never shown to anyone. Every admin action is audited.

/** SECURITY_AND_PRIVACY §6: reports, 10 per day per user. */
export const REPORT_RATE_LIMIT: RateLimitRule = {
  name: "report-user",
  limit: 10,
  windowSeconds: 24 * 60 * 60,
};

const PAGE_SIZE = 20;
const cursorSchema = z.object({ offset: z.number().int().min(0) });

type Target = { targetType: "SKILL" | "PROFILE"; targetId: string };

function requireVerified(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  if (!actor.isEmailVerified) {
    throw new ForbiddenError("Verify your email to send a report.", { code: "EMAIL_NOT_VERIFIED" });
  }
  return actor;
}

function notFound(): NotFoundError {
  return new NotFoundError("We couldn't find what you're reporting.");
}

/** The stored target: the skill id, or the user id behind a username. */
async function resolveTarget(user: AuthenticatedActor, input: CreateReportInput): Promise<Target> {
  if (input.targetType === "SKILL") {
    const skill = (await getSkillsForModeration([input.targetId])).get(input.targetId);
    // Only custom skills can be reported (RPT-01); the team curates the predefined ones.
    if (!skill || skill.status !== "ACTIVE") throw notFound();
    if (skill.origin !== "CUSTOM") {
      throw new ValidationError("Only skills added by makers can be reported.", {
        code: "NOT_REPORTABLE",
      });
    }
    return { targetType: "SKILL", targetId: skill.id };
  }
  const userId = await getUserIdByUsername(input.targetId);
  if (!userId) throw notFound();
  if (userId === user.id) {
    throw new UnprocessableError("You can't report your own profile.", { code: "SELF_REPORT" });
  }
  return { targetType: "PROFILE", targetId: userId };
}

/**
 * POST /api/reports (RPT-01…03): one open report per reporter and target (asking again returns
 * the same one), 10 a day.
 */
export async function createReport(actor: Actor, input: CreateReportInput): Promise<void> {
  const user = requireVerified(actor);
  const target = await resolveTarget(user, input);
  if (await findOpenReport(user.id, target)) return;
  await enforceRateLimit(REPORT_RATE_LIMIT, user.id);
  await insertReport({
    reporterId: user.id,
    ...target,
    reason: input.reason,
    note: input.note || null,
  });
}

/** GET /api/admin/reports: one group per target, most recent report first. */
export async function listReportGroups(
  actor: Actor,
  query: AdminReportsQuery,
): Promise<Paginated<ReportGroup>> {
  requireAdmin(actor);
  const offset = query.cursor ? decodeCursor(query.cursor, cursorSchema).offset : 0;
  const statuses =
    query.status === "OPEN" ? (["OPEN"] as const) : (["ACTIONED", "DISMISSED"] as const);
  const groups = await findReportedTargets({
    statuses: [...statuses],
    offset,
    take: PAGE_SIZE + 1,
  });
  const page = groups.slice(0, PAGE_SIZE);
  const targets = page.map(({ targetType, targetId }) => ({ targetType, targetId }));
  const [reports, skills, profiles] = await Promise.all([
    findReportsForTargets(targets, [...statuses]),
    getSkillsForModeration(targets.flatMap((t) => (t.targetType === "SKILL" ? t.targetId : []))),
    getProfilesForModeration(
      targets.flatMap((t) => (t.targetType === "PROFILE" ? t.targetId : [])),
    ),
  ]);

  const items = page.map((group): ReportGroup => {
    const mine = reports.filter(
      (report) => report.targetType === group.targetType && report.targetId === group.targetId,
    );
    const reasons: Partial<Record<ReportReason, number>> = {};
    for (const report of mine) reasons[report.reason] = (reasons[report.reason] ?? 0) + 1;
    const skill = group.targetType === "SKILL" ? skills.get(group.targetId) : undefined;
    const profile = group.targetType === "PROFILE" ? profiles.get(group.targetId) : undefined;
    const isHidden = skill ? skill.status === "HIDDEN" : (profile?.isHidden ?? false);
    return {
      reportId: mine[0]?.id ?? "",
      targetType: group.targetType,
      target: skill
        ? {
            label: skill.name,
            href: isHidden ? null : `/s/${skill.slug}`,
            detail: "Custom skill",
            isHidden,
          }
        : profile
          ? {
              label: profile.displayName,
              href: isHidden ? null : `/u/${profile.username}`,
              detail: `@${profile.username}`,
              isHidden,
            }
          : { label: null, href: null, detail: null, isHidden: false },
      reportCount: group._count._all,
      reasons,
      notes: mine.flatMap((report) =>
        report.note
          ? [
              {
                reason: report.reason,
                note: report.note,
                createdAt: report.createdAt.toISOString(),
              },
            ]
          : [],
      ),
      latestAt: (group._max.createdAt ?? new Date()).toISOString(),
      status: mine[0]?.status ?? "OPEN",
    };
  });
  return {
    items,
    nextCursor: groups.length > PAGE_SIZE ? encodeCursor({ offset: offset + PAGE_SIZE }) : null,
  };
}

async function setHidden(target: Target, hidden: boolean): Promise<void> {
  if (target.targetType === "SKILL") await setSkillHidden(target.targetId, hidden);
  else await setProfileHidden(target.targetId, hidden);
}

/**
 * POST /api/admin/reports/{id}/action: HIDE_TARGET (hide it, resolve its open reports as
 * actioned), DISMISS (resolve them as dismissed) or RESTORE_TARGET (show a hidden target again).
 */
export async function actOnReport(
  actor: Actor,
  reportId: string,
  input: ReportActionInput,
): Promise<void> {
  const admin = requireAdmin(actor);
  const report = await findReport(reportId);
  if (!report) throw new NotFoundError("We couldn't find that report.");
  const target: Target = { targetType: report.targetType, targetId: report.targetId };

  let resolved = 0;
  if (input.action === "HIDE_TARGET") {
    await setHidden(target, true);
    resolved = await resolveOpenReports(target, "ACTIONED", admin.id);
  } else if (input.action === "DISMISS") {
    resolved = await resolveOpenReports(target, "DISMISSED", admin.id);
  } else {
    await setHidden(target, false);
  }
  await recordAudit({
    actorId: admin.id,
    action: {
      HIDE_TARGET: "report.hide_target",
      DISMISS: "report.dismiss",
      RESTORE_TARGET: "report.restore_target",
    }[input.action],
    targetType: target.targetType === "SKILL" ? "skill" : "user",
    targetId: target.targetId,
    metadata: { reportId, resolvedReports: resolved },
  });
}
