import "server-only";

import type { Prisma, SkillAccent, SkillOrigin } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

const summarySelect = {
  id: true,
  name: true,
  slug: true,
  accent: true,
  origin: true,
  hint: true,
} as const;

export type SkillSummaryRow = {
  id: string;
  name: string;
  slug: string;
  accent: SkillAccent;
  origin: SkillOrigin;
  hint: string | null;
};

export async function findSkillByNormalizedName(normalizedName: string) {
  return db.skill.findUnique({
    where: { normalizedName },
    select: { ...summarySelect, status: true },
  });
}

export async function findActiveSkillDetailBySlug(slug: string) {
  return db.skill.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      ...summarySelect,
      description: true,
      hint: true,
      pitch: true,
      relatedFrom: {
        where: { to: { status: "ACTIVE" } },
        select: { to: { select: summarySelect } },
        orderBy: { to: { name: "asc" } },
      },
    },
  });
}

export async function findSlugsStartingWith(baseSlug: string): Promise<string[]> {
  const rows = await db.skill.findMany({
    where: { slug: { startsWith: baseSlug } },
    select: { slug: true },
  });
  return rows.map((row) => row.slug);
}

export async function insertCustomSkill(data: {
  name: string;
  normalizedName: string;
  slug: string;
  accent: SkillAccent;
  createdById: string;
}) {
  return db.skill.create({
    data: { ...data, origin: "CUSTOM" },
    select: summarySelect,
  });
}

/** Alphabetical page of active skills, after the (name, id) of the previous page's last row. */
export async function listActiveSkills(options: {
  origin?: SkillOrigin;
  after?: { name: string; id: string };
  take: number;
}): Promise<SkillSummaryRow[]> {
  const { origin, after, take } = options;
  return db.skill.findMany({
    where: {
      status: "ACTIVE",
      ...(origin ? { origin } : {}),
      ...(after
        ? { OR: [{ name: { gt: after.name } }, { name: after.name, id: { gt: after.id } }] }
        : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take,
    select: summarySelect,
  });
}

/**
 * Active skills matching a search term: prefix matches first, then typo-tolerant trigram matches
 * (`%` uses the skill_name_trgm_idx GIN index), ranked by similarity.
 */
export async function searchActiveSkills(options: {
  term: string;
  origin?: SkillOrigin;
  offset: number;
  take: number;
}): Promise<SkillSummaryRow[]> {
  const { term, origin, offset, take } = options;
  const prefixPattern = `${term.replace(/[\\%_]/g, "\\$&")}%`;
  return db.$queryRaw<SkillSummaryRow[]>`
    SELECT id, name, slug, accent, origin, hint
    FROM skill
    WHERE status = 'ACTIVE'
      AND (${origin ?? null}::"SkillOrigin" IS NULL OR origin = ${origin ?? null}::"SkillOrigin")
      AND (normalized_name LIKE ${prefixPattern} OR name % ${term})
    ORDER BY (normalized_name LIKE ${prefixPattern}) DESC, similarity(name, ${term}) DESC, name ASC, id ASC
    OFFSET ${offset}
    LIMIT ${take}
  `;
}

export async function findActiveSkillsByIds(ids: string[]): Promise<SkillSummaryRow[]> {
  return db.skill.findMany({
    where: { id: { in: ids }, status: "ACTIVE" },
    select: summarySelect,
  });
}

/** Active skills with a pitch, except `excludeIds`, with their related skills (FEED-14). */
export async function findPitchedSkills(excludeIds: string[]) {
  return db.skill.findMany({
    where: { status: "ACTIVE", pitch: { not: null }, id: { notIn: excludeIds } },
    orderBy: { name: "asc" },
    select: {
      ...summarySelect,
      pitch: true,
      coverMediaId: true,
      relatedFrom: { select: { toSkillId: true } },
    },
  });
}

export async function findSkillStatuses(ids: string[]) {
  return db.skill.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
}

export async function findSkillsBySlugs(slugs: string[]) {
  return db.skill.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, status: true },
  });
}

const adminSkillSelect = {
  id: true,
  name: true,
  slug: true,
  origin: true,
  status: true,
  description: true,
  hint: true,
  pitch: true,
  coverMediaId: true,
  relatedFrom: { select: { toSkillId: true }, orderBy: { to: { name: "asc" } } },
} satisfies Prisma.SkillSelect;

export type AdminSkillRow = Prisma.SkillGetPayload<{ select: typeof adminSkillSelect }>;

export async function findAdminSkill(id: string): Promise<AdminSkillRow | null> {
  return db.skill.findUnique({ where: { id }, select: adminSkillSelect });
}

export async function updateSkillFields(
  id: string,
  data: Prisma.SkillUncheckedUpdateInput,
  tx: Prisma.TransactionClient,
) {
  await tx.skill.update({ where: { id }, data });
}

/** Related skills are symmetric: both directions are replaced. */
export async function replaceRelatedSkills(
  skillId: string,
  relatedIds: string[],
  tx: Prisma.TransactionClient,
) {
  await tx.skillRelation.deleteMany({
    where: { OR: [{ fromSkillId: skillId }, { toSkillId: skillId }] },
  });
  await tx.skillRelation.createMany({
    data: relatedIds.flatMap((relatedId) => [
      { fromSkillId: skillId, toSkillId: relatedId },
      { fromSkillId: relatedId, toSkillId: skillId },
    ]),
    skipDuplicates: true,
  });
}

/** Every skill, hidden ones included, alphabetically (admin list; a few hundred at most in P1). */
export async function findAllSkillsForAdmin() {
  return db.skill.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, slug: true, origin: true, status: true },
  });
}

/** Most recently added active skills (Explore "New skills"). */
export async function findNewestActiveSkills(take: number): Promise<SkillSummaryRow[]> {
  return db.skill.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: summarySelect,
  });
}

/** Active skills with an editor's hint, except `excludeIds`, with their related skills. */
export async function findHintedSkills(excludeIds: string[]) {
  return db.skill.findMany({
    where: { status: "ACTIVE", hint: { not: null }, id: { notIn: excludeIds } },
    orderBy: { name: "asc" },
    select: { ...summarySelect, hint: true, relatedFrom: { select: { toSkillId: true } } },
  });
}

/** Skills by id with what moderation needs (reports, P1-28b). */
export async function findSkillsForModeration(ids: string[]) {
  return db.skill.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, slug: true, origin: true, status: true },
  });
}

export async function updateSkillStatus(id: string, status: "ACTIVE" | "HIDDEN"): Promise<void> {
  await db.skill.update({ where: { id }, data: { status } });
}
