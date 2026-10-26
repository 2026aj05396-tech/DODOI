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
