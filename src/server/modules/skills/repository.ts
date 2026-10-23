import "server-only";

import type { SkillAccent, SkillOrigin } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

const summarySelect = {
  id: true,
  name: true,
  slug: true,
  accent: true,
  origin: true,
} as const;

export type SkillSummaryRow = {
  id: string;
  name: string;
  slug: string;
  accent: SkillAccent;
  origin: SkillOrigin;
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
    SELECT id, name, slug, accent, origin
    FROM skill
    WHERE status = 'ACTIVE'
      AND (${origin ?? null}::"SkillOrigin" IS NULL OR origin = ${origin ?? null}::"SkillOrigin")
      AND (normalized_name LIKE ${prefixPattern} OR name % ${term})
    ORDER BY (normalized_name LIKE ${prefixPattern}) DESC, similarity(name, ${term}) DESC, name ASC, id ASC
    OFFSET ${offset}
    LIMIT ${take}
  `;
}
