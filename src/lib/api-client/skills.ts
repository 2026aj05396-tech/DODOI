import type { Paginated } from "@/lib/types/api";
import type { PostCard } from "@/lib/types/posts";
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

/** All active skills A–Z, optionally filtered (All skills page). */
export function listSkillsPage(
  q: string,
  cursor?: string | null,
): Promise<Paginated<SkillSummary>> {
  const params = new URLSearchParams({ limit: "50" });
  if (q) params.set("q", q);
  if (cursor) params.set("cursor", cursor);
  return requestJson<Paginated<SkillSummary>>("GET", `/api/skills?${params}`);
}

/** A skill's published posts, newest first. */
export function getSkillPosts(slug: string, cursor?: string | null): Promise<Paginated<PostCard>> {
  const params = new URLSearchParams(cursor ? { cursor } : {});
  return requestJson<Paginated<PostCard>>("GET", `/api/skills/${slug}/posts?${params}`);
}

/** Adds or removes one interest (skill page). */
export function setInterest(skillId: string, isInterest: boolean): Promise<void> {
  return requestJson(isInterest ? "PUT" : "DELETE", `/api/me/interests/${skillId}`);
}
