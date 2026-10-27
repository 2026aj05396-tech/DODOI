import "server-only";

import type { Prisma, ReportReason } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

type Target = { targetType: "SKILL" | "PROFILE"; targetId: string };

export async function findOpenReport(reporterId: string, target: Target) {
  return db.report.findFirst({
    where: { reporterId, ...target, status: "OPEN" },
    select: { id: true },
  });
}

export async function insertReport(data: {
  reporterId: string;
  targetType: "SKILL" | "PROFILE";
  targetId: string;
  reason: ReportReason;
  note: string | null;
}) {
  return db.report.create({ data, select: { id: true } });
}

/** Targets with reports in `statuses`, most recent report first, one row per target. */
export async function findReportedTargets(options: {
  statuses: ("OPEN" | "ACTIONED" | "DISMISSED")[];
  offset: number;
  take: number;
}) {
  const where: Prisma.ReportWhereInput = { status: { in: options.statuses } };
  const groups = await db.report.groupBy({
    by: ["targetType", "targetId"],
    where,
    _count: { _all: true },
    _max: { createdAt: true, resolvedAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    skip: options.offset,
    take: options.take,
  });
  return groups;
}

/** The reports about these targets in `statuses`, newest first. */
export async function findReportsForTargets(
  targets: Target[],
  statuses: ("OPEN" | "ACTIONED" | "DISMISSED")[],
) {
  if (targets.length === 0) return [];
  return db.report.findMany({
    where: { status: { in: statuses }, OR: targets },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      reason: true,
      note: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function findReport(id: string) {
  return db.report.findUnique({
    where: { id },
    select: { id: true, targetType: true, targetId: true, status: true },
  });
}

/** Resolves every open report about the target. Returns how many. */
export async function resolveOpenReports(
  target: Target,
  status: "ACTIONED" | "DISMISSED",
  resolvedById: string,
): Promise<number> {
  const { count } = await db.report.updateMany({
    where: { ...target, status: "OPEN" },
    data: { status, resolvedById, resolvedAt: new Date() },
  });
  return count;
}
