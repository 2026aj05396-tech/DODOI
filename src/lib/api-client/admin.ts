import type {
  CreateAdminPostInput,
  CreateAdminThemeInput,
  SetRelatedSkillsInput,
  UpdateAdminPostInput,
  UpdateAdminSkillInput,
  UpdateAdminThemeInput,
} from "@/lib/schemas/admin";
import type { AdminPost, AdminPostSummary, AdminSkill, AdminTheme } from "@/lib/types/admin";
import type { Paginated } from "@/lib/types/api";

import { postJson, requestJson } from "./request";

// Admin API (API_SPECIFICATION §8).

export function listAdminPosts(params: {
  status?: string;
  cursor?: string | null;
}): Promise<Paginated<AdminPostSummary>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.cursor) query.set("cursor", params.cursor);
  return requestJson("GET", `/api/admin/posts?${query}`);
}

export function createAdminPost(input: CreateAdminPostInput): Promise<AdminPost> {
  return postJson("/api/admin/posts", input);
}

export function updateAdminPost(id: string, input: UpdateAdminPostInput): Promise<AdminPost> {
  return requestJson("PATCH", `/api/admin/posts/${id}`, input);
}

export function publishAdminPost(id: string): Promise<AdminPost> {
  return postJson(`/api/admin/posts/${id}/publish`);
}

export function unpublishAdminPost(id: string): Promise<AdminPost> {
  return postJson(`/api/admin/posts/${id}/unpublish`);
}

export function deleteAdminPost(id: string): Promise<void> {
  return requestJson("DELETE", `/api/admin/posts/${id}`);
}

export function createAdminTheme(input: CreateAdminThemeInput): Promise<AdminTheme> {
  return postJson("/api/admin/themes", input);
}

export function updateAdminTheme(id: string, input: UpdateAdminThemeInput): Promise<AdminTheme> {
  return requestJson("PATCH", `/api/admin/themes/${id}`, input);
}

export function deleteAdminTheme(id: string): Promise<void> {
  return requestJson("DELETE", `/api/admin/themes/${id}`);
}

export function updateAdminSkill(id: string, input: UpdateAdminSkillInput): Promise<AdminSkill> {
  return requestJson("PATCH", `/api/admin/skills/${id}`, input);
}

export function setRelatedSkills(id: string, input: SetRelatedSkillsInput): Promise<AdminSkill> {
  return requestJson("PUT", `/api/admin/skills/${id}/related`, input);
}
