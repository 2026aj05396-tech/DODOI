import type { SkillAccent, SkillOrigin, SkillStatus } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";

// Test data builders (TESTING_STRATEGY §2). `create*` persists to the test database.

let sequence = 0;
const next = () => ++sequence;

export async function createUser(
  overrides: { email?: string; emailVerified?: Date | null; passwordHash?: string | null } = {},
) {
  const n = next();
  return db.user.create({
    data: {
      email: overrides.email ?? `user${n}@example.test`,
      emailVerified: overrides.emailVerified === undefined ? new Date() : overrides.emailVerified,
      passwordHash: overrides.passwordHash ?? null,
    },
  });
}

export function actorFor(
  user: { id: string; emailVerified: Date | null },
  role: AuthenticatedActor["role"] = "USER",
): AuthenticatedActor {
  return { id: user.id, role, isEmailVerified: user.emailVerified !== null };
}

export async function createSkill(
  name: string,
  overrides: { origin?: SkillOrigin; status?: SkillStatus; accent?: SkillAccent } = {},
) {
  const normalizedName = name.trim().replace(/\s+/g, " ").toLowerCase();
  return db.skill.create({
    data: {
      name,
      normalizedName,
      slug: normalizedName.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      accent: overrides.accent ?? "BUTTER",
      origin: overrides.origin ?? "PREDEFINED",
      status: overrides.status ?? "ACTIVE",
    },
  });
}
