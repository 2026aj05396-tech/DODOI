import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { SetRelatedSkillsInput, UpdateAdminSkillInput } from "@/lib/schemas/admin";
import type { AdminSkill } from "@/lib/types/admin";
import { db } from "@/server/db/client";
import { requireAdmin, type Actor } from "@/server/lib/actor";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { recordAudit } from "@/server/modules/admin";

import {
  findAdminSkill,
  findAllSkillsForAdmin,
  findSkillStatuses,
  replaceRelatedSkills,
  updateSkillFields,
  type AdminSkillRow,
} from "./repository";

// Admin skill editing (API_SPECIFICATION §8): editorial fields, visibility and related skills.
// Any skill can be hidden, predefined ones included (PO decision, P1-16). Every change is audited.

function toAdminSkill(row: AdminSkillRow): AdminSkill {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    origin: row.origin,
    status: row.status,
    description: row.description,
    hint: row.hint,
    pitch: row.pitch,
    coverMediaId: row.coverMediaId,
    relatedSkillIds: row.relatedFrom.map((relation) => relation.toSkillId),
  };
}

async function loadAdminSkill(id: string): Promise<AdminSkillRow> {
  const row = await findAdminSkill(id);
  if (!row) throw new NotFoundError("We couldn't find that skill.");
  return row;
}

/** Hiding/showing is audited as its own action so it stands out in the log. */
function auditAction(before: AdminSkillRow, input: UpdateAdminSkillInput): string {
  if (input.status && input.status !== before.status) {
    return input.status === "HIDDEN" ? "skill.hide" : "skill.show";
  }
  return "skill.update";
}

export type AdminSkillListItem = {
  id: string;
  name: string;
  slug: string;
  origin: "PREDEFINED" | "CUSTOM";
  status: "ACTIVE" | "HIDDEN";
};

/** GET /api/admin/skills: every skill, hidden ones included. */
export async function listAdminSkills(actor: Actor): Promise<AdminSkillListItem[]> {
  requireAdmin(actor);
  return findAllSkillsForAdmin();
}

export async function getAdminSkill(actor: Actor, id: string): Promise<AdminSkill> {
  requireAdmin(actor);
  return toAdminSkill(await loadAdminSkill(id));
}

/** PATCH /api/admin/skills/{id}. */
export async function updateAdminSkill(
  actor: Actor,
  id: string,
  input: UpdateAdminSkillInput,
): Promise<AdminSkill> {
  const admin = requireAdmin(actor);
  const before = await loadAdminSkill(id);
  try {
    await db.$transaction(async (tx) => {
      await updateSkillFields(id, input, tx);
      await recordAudit(
        {
          actorId: admin.id,
          action: auditAction(before, input),
          targetType: "skill",
          targetId: id,
          metadata: { fields: Object.keys(input) },
        },
        tx,
      );
    });
  } catch (error) {
    // The cover must be an uploaded media asset (foreign key).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new ValidationError(undefined, {
        fields: { coverMediaId: "That cover image doesn't exist. Upload it again." },
      });
    }
    throw error;
  }
  return toAdminSkill(await loadAdminSkill(id));
}

/** PUT /api/admin/skills/{id}/related: replaces the related skills (stored both ways). */
export async function setRelatedSkills(
  actor: Actor,
  id: string,
  input: SetRelatedSkillsInput,
): Promise<AdminSkill> {
  const admin = requireAdmin(actor);
  await loadAdminSkill(id);
  if (input.skillIds.includes(id)) {
    throw new ValidationError(undefined, {
      fields: { skillIds: "A skill can't be related to itself." },
    });
  }
  const existing = new Set((await findSkillStatuses(input.skillIds)).map((row) => row.id));
  if (input.skillIds.some((skillId) => !existing.has(skillId))) {
    throw new ValidationError(undefined, { fields: { skillIds: "Some skills don't exist." } });
  }

  await db.$transaction(async (tx) => {
    await replaceRelatedSkills(id, input.skillIds, tx);
    await recordAudit(
      {
        actorId: admin.id,
        action: "skill.set_related",
        targetType: "skill",
        targetId: id,
        metadata: { relatedSkillIds: input.skillIds },
      },
      tx,
    );
  });
  return toAdminSkill(await loadAdminSkill(id));
}
