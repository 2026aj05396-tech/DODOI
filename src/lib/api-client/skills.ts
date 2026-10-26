import type { Paginated } from "@/lib/types/api";
import type { SkillSummary } from "@/lib/types/skills";

import { postJson, requestJson } from "./request";

// Skills (API_SPECIFICATION §4).

/** Active skills matching `q` (prefix and typo-tolerant). */
export function searchSkills(q: string, limit = 20): Promise<Paginated<SkillSummary>> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return requestJson<Paginated<SkillSummary>>("GET", `/api/skills?${params}`);
}

/** Adds a custom interest, or returns the existing skill with that name. */
export function createCustomSkill(name: string): Promise<SkillSummary> {
  return postJson<SkillSummary>("/api/skills", { name });
}
