import { z } from "zod";

// API contracts for communities (API_SPECIFICATION §9.3, P3-01; COM-01…08).

export const COMMUNITY_NAME_MIN = 3;
export const COMMUNITY_NAME_MAX = 40;
export const COMMUNITY_DESCRIPTION_MAX = 300;
export const COMMUNITY_RULES_MAX = 5;
export const COMMUNITY_RULE_MAX = 150;
export const COMMUNITY_POST_MAX = 2_000;
export const COMMUNITY_MAX_PHOTOS = 4;

const id = z.string().min(1).max(40);
const unique = <T>(values: T[]) => new Set(values).size === values.length;

/** Display form of a name or line: Unicode-normalised, trimmed, inner whitespace collapsed. */
const tidy = (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " ");

/** POST /api/communities (COM-01): a name, one skill, a description and up to 5 rules. */
export const createCommunitySchema = z.object({
  name: z
    .string()
    .transform(tidy)
    .pipe(
      z
        .string()
        .min(COMMUNITY_NAME_MIN, `Use at least ${COMMUNITY_NAME_MIN} characters for the name.`)
        .max(COMMUNITY_NAME_MAX, `Keep the name to ${COMMUNITY_NAME_MAX} characters or fewer.`),
    ),
  skillId: id,
  description: z
    .string()
    .transform(tidy)
    .pipe(
      z
        .string()
        .min(1, "Say what this community is about.")
        .max(
          COMMUNITY_DESCRIPTION_MAX,
          `Keep the description to ${COMMUNITY_DESCRIPTION_MAX} characters or fewer.`,
        ),
    ),
  rules: z
    .array(
      z
        .string()
        .transform(tidy)
        .pipe(
          z
            .string()
            .min(1, "A rule can't be empty.")
            .max(
              COMMUNITY_RULE_MAX,
              `Keep each rule to ${COMMUNITY_RULE_MAX} characters or fewer.`,
            ),
        ),
    )
    .max(COMMUNITY_RULES_MAX, `A community can have up to ${COMMUNITY_RULES_MAX} rules.`)
    .default([]),
});
export type CreateCommunityInput = z.output<typeof createCommunitySchema>;

/** GET /api/communities: discovery (interests first, then newest), optional name search and craft. */
export const communityListQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  skill: id.optional(),
  /** `mine=true` lists only the communities the member has joined ("Your circles"). */
  mine: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  cursor: z.string().max(500).optional(),
});
export type CommunityListQuery = z.output<typeof communityListQuerySchema>;

export const communitySlugParamsSchema = z.object({ slug: z.string().min(1).max(60) });
export const communityPostIdParamsSchema = z.object({ id });

export const communityPostsQuerySchema = z.object({ cursor: z.string().max(500).optional() });

/** POST /api/communities/{slug}/posts: text, up to 4 photos, and a parent for a reply (COM-05). */
export const createCommunityPostSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a few words first.")
    .max(COMMUNITY_POST_MAX, `Keep it to ${COMMUNITY_POST_MAX} characters or fewer.`),
  mediaIds: z
    .array(id)
    .max(COMMUNITY_MAX_PHOTOS, `A post can have up to ${COMMUNITY_MAX_PHOTOS} photos.`)
    .refine(unique, "Each photo can only be added once.")
    .default([]),
  parentId: id.optional(),
});
export type CreateCommunityPostInput = z.output<typeof createCommunityPostSchema>;

/** PATCH /api/community-posts/{id}: the author edits the text for 15 minutes. */
export const updateCommunityPostSchema = z.object({
  body: createCommunityPostSchema.shape.body,
});
export type UpdateCommunityPostInput = z.output<typeof updateCommunityPostSchema>;

export const communityRoleSchema = z.enum(["OWNER", "MODERATOR", "MEMBER"]);
export type CommunityRoleName = z.output<typeof communityRoleSchema>;

/** POST /api/communities/{slug}/moderation (COM-04, COM-06). */
export const communityModerationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("HIDE_POST"), targetId: id }),
  z.object({ action: z.literal("RESTORE_POST"), targetId: id }),
  z.object({ action: z.literal("REMOVE_MEMBER"), targetId: id }),
  z.object({ action: z.literal("ALLOW_MEMBER"), targetId: id }),
  z.object({ action: z.literal("SET_ROLE"), targetId: id, role: communityRoleSchema }),
]);
export type CommunityModerationInput = z.output<typeof communityModerationSchema>;
