import "server-only";

import type { UpdatePostProgressInput } from "@/lib/schemas/posts";
import type { PostProgress } from "@/lib/types/posts";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import { NotFoundError, UnauthenticatedError, ValidationError } from "@/server/lib/errors";

import { findProgress, findProgressTargets, upsertProgress } from "./progress-repository";

// Tutorial progress (POST-11/12, DC-07, API_SPECIFICATION §5): ticked materials and done steps,
// private to the signed-in user and synced across their devices. Ticks on materials or steps that
// no longer exist (removed by an admin) are left out on read and dropped on the next write
// (DATABASE_SCHEMA §4.5b).

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

/** The post's material ids and step positions; 404 unless the actor may see the post. */
async function loadTargets(actor: AuthenticatedActor, postId: string) {
  const post = await findProgressTargets(postId);
  if (!post || (post.status !== "PUBLISHED" && actor.role !== "ADMIN")) {
    throw new NotFoundError("We couldn't find that post.");
  }
  return {
    materialIds: new Set(post.materials.map((material) => material.id)),
    stepPositions: new Set(post.steps.map((step) => step.position)),
  };
}

type Targets = Awaited<ReturnType<typeof loadTargets>>;

function toProgress(
  row: { checkedMaterialIds: string[]; completedStepPositions: number[]; updatedAt: Date } | null,
  targets: Targets,
): PostProgress {
  return {
    checkedMaterialIds: (row?.checkedMaterialIds ?? []).filter((id) => targets.materialIds.has(id)),
    completedStepPositions: (row?.completedStepPositions ?? [])
      .filter((position) => targets.stepPositions.has(position))
      .sort((a, b) => a - b),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

/** GET /api/posts/{postId}/progress: empty lists until the user ticks something. */
export async function getPostProgress(actor: Actor, postId: string): Promise<PostProgress> {
  const user = requireSignedIn(actor);
  const targets = await loadTargets(user, postId);
  return toProgress(await findProgress(user.id, postId), targets);
}

/** PUT /api/posts/{postId}/progress: replaces the lists given; ids must belong to the post. */
export async function updatePostProgress(
  actor: Actor,
  postId: string,
  input: UpdatePostProgressInput,
): Promise<PostProgress> {
  const user = requireSignedIn(actor);
  const targets = await loadTargets(user, postId);

  const fields: Record<string, string> = {};
  if (input.checkedMaterialIds?.some((id) => !targets.materialIds.has(id))) {
    fields.checkedMaterialIds = "Some materials aren't part of this post.";
  }
  if (input.completedStepPositions?.some((position) => !targets.stepPositions.has(position))) {
    fields.completedStepPositions = "Some steps aren't part of this post.";
  }
  if (Object.keys(fields).length > 0) throw new ValidationError(undefined, { fields });

  const current = toProgress(await findProgress(user.id, postId), targets);
  const saved = await upsertProgress(user.id, postId, {
    checkedMaterialIds: input.checkedMaterialIds ?? current.checkedMaterialIds,
    completedStepPositions: input.completedStepPositions ?? current.completedStepPositions,
  });
  return toProgress(saved, targets);
}
