import type {
  CreateEntryInput,
  CreateProjectInput,
  UpdateEntryInput,
  UpdateProjectInput,
} from "@/lib/schemas/journal";
import type { Project } from "@/lib/types/journal";

import { postJson, requestJson } from "./request";

// The creative journal (API_SPECIFICATION §9.1, P2-03).

export function createProject(input: Partial<CreateProjectInput>): Promise<Project> {
  return postJson<Project>("/api/me/projects", input);
}

export function startProjectFromPost(postId: string): Promise<Project> {
  return postJson<Project>(`/api/posts/${postId}/start-project`);
}

export function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  return requestJson<Project>("PATCH", `/api/projects/${id}`, input);
}

export function deleteProject(id: string): Promise<void> {
  return requestJson("DELETE", `/api/projects/${id}`);
}

export function addEntry(projectId: string, input: Partial<CreateEntryInput>): Promise<Project> {
  return postJson<Project>(`/api/projects/${projectId}/entries`, input);
}

export function updateEntry(
  projectId: string,
  entryId: string,
  input: UpdateEntryInput,
): Promise<Project> {
  return requestJson<Project>("PATCH", `/api/projects/${projectId}/entries/${entryId}`, input);
}

export function deleteEntry(projectId: string, entryId: string): Promise<void> {
  return requestJson("DELETE", `/api/projects/${projectId}/entries/${entryId}`);
}

export function checkMaterial(projectId: string, materialId: string, checked: boolean) {
  return requestJson("PUT", `/api/projects/${projectId}/materials/${materialId}`, { checked });
}
