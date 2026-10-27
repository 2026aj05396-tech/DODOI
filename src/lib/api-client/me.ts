import type {
  OnboardingStepInput,
  ReplaceUserSkillsInput,
  UpdateProfileInput,
} from "@/lib/schemas/me";
import type { MyProfile, OnboardingState, UserSkills } from "@/lib/types/me";

import { postJson, requestJson } from "./request";

// The signed-in user's skills and onboarding (API_SPECIFICATION §4).

export function getMySkills(): Promise<UserSkills> {
  return requestJson<UserSkills>("GET", "/api/me/skills");
}

export function replaceMySkills(input: ReplaceUserSkillsInput): Promise<UserSkills> {
  return requestJson<UserSkills>("PUT", "/api/me/skills", input);
}

export function getOnboardingState(): Promise<OnboardingState> {
  return requestJson<OnboardingState>("GET", "/api/me/onboarding");
}

export function saveOnboardingStep(input: OnboardingStepInput): Promise<OnboardingState> {
  return requestJson<OnboardingState>("PUT", "/api/me/onboarding", input);
}

export function completeOnboarding(): Promise<void> {
  return postJson("/api/me/onboarding/complete");
}

export function getMyProfile(): Promise<MyProfile> {
  return requestJson<MyProfile>("GET", "/api/me/profile");
}

export function updateMyProfile(input: UpdateProfileInput): Promise<MyProfile> {
  return requestJson<MyProfile>("PATCH", "/api/me/profile", input);
}
