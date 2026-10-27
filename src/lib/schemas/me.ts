import { z } from "zod";

// API contracts for the signed-in user's skills and onboarding (API_SPECIFICATION §4).

/** PO decision (P1-10): interests, can-help and want-to-learn skills together. */
export const MAX_USER_SKILLS = 50;
/** OD-14: onboarding needs at least 3 interests. */
export const MIN_ONBOARDING_INTERESTS = 3;
export const ONBOARDING_STEPS = 3;

export const experienceLevelSchema = z.enum(["CURIOUS", "BEGINNER", "INTERMEDIATE", "EXPERIENCED"]);

export type ExperienceLevel = z.output<typeof experienceLevelSchema>;

const userSkillInputSchema = z.object({
  skillId: z.string().min(1).max(40),
  isInterest: z.boolean().default(false),
  canHelp: z.boolean().default(false),
  wantsToLearn: z.boolean().default(false),
  /** Null = not specified (step 2 skipped; PO decision P1-10). */
  level: experienceLevelSchema.nullable().default(null),
});

export const replaceUserSkillsSchema = z.object({
  items: z
    .array(userSkillInputSchema)
    .max(MAX_USER_SKILLS, `You can add up to ${MAX_USER_SKILLS} skills.`)
    .refine((items) => new Set(items.map((item) => item.skillId)).size === items.length, {
      message: "Each skill can only appear once.",
    }),
});

export type ReplaceUserSkillsInput = z.output<typeof replaceUserSkillsSchema>;

export const onboardingStepSchema = z.object({
  step: z.number().int().min(1).max(ONBOARDING_STEPS),
});

export type OnboardingStepInput = z.output<typeof onboardingStepSchema>;

/** OD-11: 3–20 characters, lowercase letters, digits, `_` and `-`, starting with a letter. */
export const USERNAME_RULES = /^[a-z][a-z0-9_-]{2,19}$/;

/** PATCH /api/me/profile (API_SPECIFICATION §4, PRF-01/04/06): any subset of the fields. */
export const updateProfileSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        USERNAME_RULES,
        "Use 3–20 lowercase letters, numbers, _ or -, starting with a letter.",
      ),
    displayName: z
      .string()
      .trim()
      .min(1, "Add your name.")
      .max(50, "Keep your name to 50 characters or fewer."),
    bio: z
      .string()
      .trim()
      .max(300, "Keep your bio to 300 characters or fewer.")
      .nullable()
      .transform((bio) => bio || null),
    avatarMediaId: z.string().min(1).max(40).nullable(),
    visibility: z.enum(["PUBLIC", "PRIVATE"]),
  })
  .partial();
export type UpdateProfileInput = z.output<typeof updateProfileSchema>;

export const usernameParamsSchema = z.object({ username: z.string().trim().min(1).max(40) });
