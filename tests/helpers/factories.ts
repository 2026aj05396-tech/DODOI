import type { SkillAccent, SkillOrigin, SkillStatus } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import type { AuthenticatedActor } from "@/server/lib/actor";

// Test data builders (TESTING_STRATEGY §2). `create*` persists to the test database.

let sequence = 0;
const next = () => ++sequence;

export async function createUser(
  overrides: {
    email?: string;
    emailVerified?: Date | null;
    passwordHash?: string | null;
    ageConfirmedAt?: Date | null;
  } = {},
) {
  const n = next();
  return db.user.create({
    data: {
      email: overrides.email ?? `user${n}@example.test`,
      emailVerified: overrides.emailVerified === undefined ? new Date() : overrides.emailVerified,
      passwordHash: overrides.passwordHash ?? null,
      ageConfirmedAt:
        overrides.ageConfirmedAt === undefined ? new Date() : overrides.ageConfirmedAt,
    },
  });
}

export function actorFor(
  user: { id: string; emailVerified: Date | null; ageConfirmedAt?: Date | null },
  role: AuthenticatedActor["role"] = "USER",
): AuthenticatedActor {
  return {
    id: user.id,
    role,
    isEmailVerified: user.emailVerified !== null,
    isAgeConfirmed: user.ageConfirmedAt !== null,
  };
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

/** A user with a profile, e.g. an invited creator. */
export async function createCreator(overrides: { isHidden?: boolean; deactivated?: boolean } = {}) {
  const n = next();
  return db.user.create({
    data: {
      email: `creator${n}@example.test`,
      emailVerified: new Date(),
      ageConfirmedAt: new Date(),
      deletionRequestedAt: overrides.deactivated ? new Date() : null,
      profile: {
        create: {
          username: `creator-${n}`,
          displayName: `Creator ${n}`,
          isHidden: overrides.isHidden ?? false,
        },
      },
    },
  });
}

type PostSkillInput = { id: string; primary?: boolean };

/** A post with `mediaCount` images; published (now, or at `publishedAt`) unless `status` says otherwise. */
export async function createPost(
  options: {
    title?: string;
    description?: string | null;
    status?: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
    publishedAt?: Date;
    skills?: PostSkillInput[];
    authorId?: string | null;
    mediaCount?: number;
    sourceType?: "TEAM_ORIGINAL" | "INVITED_CREATOR" | "STOCK_LICENSED" | "CREATIVE_COMMONS";
    steps?: string[];
    materials?: string[];
  } = {},
) {
  const n = next();
  const status = options.status ?? "PUBLISHED";
  const media = await Promise.all(
    Array.from({ length: options.mediaCount ?? 1 }, (_, index) =>
      db.mediaAsset.create({
        data: {
          type: "IMAGE",
          publicId: `dodoi/local/posts/post${n}-${index}`,
          format: "jpg",
          width: 1200,
          height: 900,
          bytes: 100_000,
          altText: `Photo ${index + 1}`,
        },
      }),
    ),
  );
  return db.post.create({
    data: {
      type: "TUTORIAL",
      status,
      title: options.title ?? `Post ${n}`,
      description: options.description === undefined ? `About post ${n}` : options.description,
      authorId: options.authorId ?? null,
      publishedAt: status === "PUBLISHED" ? (options.publishedAt ?? new Date()) : null,
      skills: {
        create: (options.skills ?? []).map((skill, index) => ({
          skillId: skill.id,
          isPrimary: skill.primary ?? index === 0,
        })),
      },
      media: { create: media.map((asset, position) => ({ mediaId: asset.id, position })) },
      steps: { create: (options.steps ?? []).map((text, position) => ({ position, text })) },
      materials: {
        create: (options.materials ?? []).map((name, position) => ({ position, name })),
      },
      attribution: {
        create: {
          sourceType: options.sourceType ?? "TEAM_ORIGINAL",
          license: "Owned",
          attributionText: "Made by the dodoi team",
        },
      },
    },
  });
}

/** An uploaded media asset (as registered after a Cloudinary upload). */
export async function createMedia(
  overrides: { type?: "IMAGE" | "VIDEO"; altText?: string | null } = {},
) {
  const n = next();
  const type = overrides.type ?? "IMAGE";
  return db.mediaAsset.create({
    data: {
      type,
      publicId: `dodoi/local/posts/media${n}`,
      format: type === "VIDEO" ? "mp4" : "jpg",
      width: 1200,
      height: 900,
      bytes: 100_000,
      durationSec: type === "VIDEO" ? 30 : null,
      altText: overrides.altText === undefined ? `Photo ${n}` : overrides.altText,
    },
  });
}
