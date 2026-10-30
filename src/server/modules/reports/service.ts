import "server-only";

import { z } from "zod";

import type { ReportTargetType } from "@/generated/prisma/client";
import type {
  AdminReportsQuery,
  CreateReportInput,
  ReportActionInput,
  ReportReason,
} from "@/lib/schemas/reports";
import type { Paginated } from "@/lib/types/api";
import type { ReportGroup } from "@/lib/types/reports";
import {
  requireAdmin,
  requireModerator,
  type Actor,
  type AuthenticatedActor,
} from "@/server/lib/actor";
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
import { getAnswersForModeration, isOwnAnswer } from "@/server/modules/ai";
import { getCommentsForModeration, setCommentHidden } from "@/server/modules/comments";
import {
  getPostsForModeration,
  getPublishedPostAuthor,
  setPostHidden,
} from "@/server/modules/content";
import {
  getHelpRequestsForModeration,
  getHelpResponsesForModeration,
  getReportableHelpTarget,
  setHelpRequestHidden,
  setHelpResponseHidden,
} from "@/server/modules/help";
import { getSkillsForModeration, setSkillHidden } from "@/server/modules/skills";
import {
  getProfilesForModeration,
  getUserIdByUsername,
  getUserRole,
  isBlockedEitherWay,
  setProfileHidden,
  setUserRole,
} from "@/server/modules/users";

import {
  findOpenReport,
  findReport,
  findReportedTargets,
  findReportsForTargets,
  insertReport,
  resolveOpenReports,
} from "./repository";

// Reports (RPT-01…05, MOD-01…05, API_SPECIFICATION §6b). Verified users report custom skills,
// profiles, posts and comments; admins and moderators see one row per reported target (PO
// decision, P1-28b) and hide it, dismiss its reports, or show it again later. Reporters are never shown to anyone. Every admin action is audited.

/** SECURITY_AND_PRIVACY §6: reports, 10 per day per user. */
export const REPORT_RATE_LIMIT: RateLimitRule = {
  name: "report-user",
  limit: 10,
  windowSeconds: 24 * 60 * 60,
};

const PAGE_SIZE = 20;
const cursorSchema = z.object({ offset: z.number().int().min(0) });

type Target = { targetType: ReportTargetType; targetId: string };

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
  if (input.targetType === "POST") {
    // Only posts the reporter can see (published, not hidden, not by someone blocked).
    const post = await getPublishedPostAuthor(input.targetId);
    if (!post || (post.authorId && (await isBlockedEitherWay(user.id, post.authorId)))) {
      throw notFound();
    }
    if (post.authorId === user.id) {
      throw new UnprocessableError("You can't report your own post.", { code: "SELF_REPORT" });
    }
    return { targetType: "POST", targetId: input.targetId };
  }
  if (input.targetType === "COMMENT") {
    const comment = (await getCommentsForModeration([input.targetId])).get(input.targetId);
    if (!comment || comment.isHidden || comment.isDeleted) throw notFound();
    if (!(await getPublishedPostAuthor(comment.postId))) throw notFound();
    if (comment.authorId && (await isBlockedEitherWay(user.id, comment.authorId))) {
      throw notFound();
    }
    if (comment.authorId === user.id) {
      throw new UnprocessableError("You can't report your own comment.", { code: "SELF_REPORT" });
    }
    return { targetType: "COMMENT", targetId: input.targetId };
  }
  if (input.targetType === "HELP_REQUEST" || input.targetType === "HELP_RESPONSE") {
    // Only what the reporter can see (not hidden, not by someone blocked), and not their own.
    const type = input.targetType === "HELP_REQUEST" ? "REQUEST" : "RESPONSE";
    const target = await getReportableHelpTarget(user, type, input.targetId);
    if (!target) throw notFound();
    if (target.authorId === user.id) {
      throw new UnprocessableError(
        type === "REQUEST"
          ? "You can't report your own request."
          : "You can't report your own response.",
        { code: "SELF_REPORT" },
      );
    }
    return { targetType: input.targetType, targetId: target.id };
  }
  if (input.targetType === "AI_MESSAGE") {
    // Only an answer in the reporter's own chat (AIC-06); anything else looks like it isn't there.
    if (!(await isOwnAnswer(user, input.targetId))) throw notFound();
    return { targetType: "AI_MESSAGE", targetId: input.targetId };
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
  requireModerator(actor);
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
  const idsOf = (type: ReportTargetType) =>
    targets.flatMap((t) => (t.targetType === type ? t.targetId : []));
  const [reports, skills, profiles, posts, comments, answers, helpRequests, helpResponses] =
    await Promise.all([
      findReportsForTargets(targets, [...statuses]),
      getSkillsForModeration(idsOf("SKILL")),
      getProfilesForModeration(idsOf("PROFILE")),
      getPostsForModeration(idsOf("POST")),
      getCommentsForModeration(idsOf("COMMENT")),
      getAnswersForModeration(idsOf("AI_MESSAGE")),
      getHelpRequestsForModeration(idsOf("HELP_REQUEST")),
      getHelpResponsesForModeration(idsOf("HELP_RESPONSE")),
    ]);

  const items = page.map((group): ReportGroup => {
    const mine = reports.filter(
      (report) => report.targetType === group.targetType && report.targetId === group.targetId,
    );
    const reasons: Partial<Record<ReportReason, number>> = {};
    for (const report of mine) reasons[report.reason] = (reasons[report.reason] ?? 0) + 1;
    const skill = group.targetType === "SKILL" ? skills.get(group.targetId) : undefined;
    const profile = group.targetType === "PROFILE" ? profiles.get(group.targetId) : undefined;
    const post = group.targetType === "POST" ? posts.get(group.targetId) : undefined;
    const comment = group.targetType === "COMMENT" ? comments.get(group.targetId) : undefined;
    const answer = group.targetType === "AI_MESSAGE" ? answers.get(group.targetId) : undefined;
    const helpRequest =
      group.targetType === "HELP_REQUEST" ? helpRequests.get(group.targetId) : undefined;
    const helpResponse =
      group.targetType === "HELP_RESPONSE" ? helpResponses.get(group.targetId) : undefined;
    const isHidden = skill
      ? skill.status === "HIDDEN"
      : (profile?.isHidden ??
        post?.isHidden ??
        comment?.isHidden ??
        helpRequest?.isHidden ??
        helpResponse?.isHidden ??
        false);
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
          : post
            ? { label: post.title, href: `/p/${group.targetId}`, detail: "Post", isHidden }
            : comment
              ? {
                  label: comment.isDeleted ? null : comment.body.slice(0, 140),
                  href: `/p/${comment.postId}#comment-${group.targetId}`,
                  detail: "Comment",
                  isHidden,
                }
              : helpRequest
                ? {
                    label: helpRequest.title,
                    href: isHidden ? null : `/community/help/${group.targetId}`,
                    detail: "Help request",
                    isHidden,
                  }
                : helpResponse
                  ? {
                      label: helpResponse.body.slice(0, 140),
                      href: isHidden ? null : `/community/help/${helpResponse.requestId}`,
                      detail: "Help response",
                      isHidden,
                    }
                  : group.targetType === "AI_MESSAGE"
                    ? {
                        // Only the reported answer; its chat is gone after 30 days or when deleted.
                        label: answer?.slice(0, 400) ?? null,
                        href: null,
                        detail: "AI answer",
                        isHidden: false,
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
  switch (target.targetType) {
    case "SKILL":
      return setSkillHidden(target.targetId, hidden);
    case "PROFILE":
      return setProfileHidden(target.targetId, hidden);
    case "POST":
      return setPostHidden(target.targetId, hidden);
    case "COMMENT":
      return setCommentHidden(target.targetId, hidden);
    case "HELP_REQUEST":
      return setHelpRequestHidden(target.targetId, hidden);
    case "HELP_RESPONSE":
      return setHelpResponseHidden(target.targetId, hidden);
    case "AI_MESSAGE":
      throw new UnprocessableError("An AI answer can't be hidden. Dismiss its reports instead.", {
        code: "NOT_HIDEABLE",
      });
  }
}

const AUDIT_TARGET = {
  SKILL: "skill",
  PROFILE: "user",
  POST: "post",
  COMMENT: "comment",
  AI_MESSAGE: "ai_message",
  HELP_REQUEST: "help_request",
  HELP_RESPONSE: "help_response",
} as const;

/**
 * POST /api/admin/reports/{id}/action: HIDE_TARGET (hide it, resolve its open reports as
 * actioned), DISMISS (resolve them as dismissed) or RESTORE_TARGET (show a hidden target again).
 */
export async function actOnReport(
  actor: Actor,
  reportId: string,
  input: ReportActionInput,
): Promise<void> {
  const admin = requireModerator(actor);
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
    targetType: AUDIT_TARGET[target.targetType],
    targetId: target.targetId,
    metadata: { reportId, resolvedReports: resolved },
  });
}

/**
 * PATCH /api/admin/users/{id}/role (MOD-03): admins make someone a Moderator or take it back.
 * Admins' own roles never change here. Audited.
 */
export async function changeModeratorRole(
  actor: Actor,
  userId: string,
  role: "USER" | "MODERATOR",
): Promise<void> {
  const admin = requireAdmin(actor);
  const current = await getUserRole(userId);
  if (!current) throw new NotFoundError("We couldn't find that user.");
  if (current === "ADMIN") {
    throw new UnprocessableError("An admin's role can't be changed here.", {
      code: "ADMIN_ROLE_LOCKED",
    });
  }
  if (current === role) return;
  await setUserRole(userId, role);
  await recordAudit({
    actorId: admin.id,
    action: role === "MODERATOR" ? "user.make_moderator" : "user.remove_moderator",
    targetType: "user",
    targetId: userId,
  });
}
