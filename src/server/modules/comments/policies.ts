import type { AuthenticatedActor } from "@/server/lib/actor";

// Comment authorization (SECURITY_AND_PRIVACY §3, Phase 2 matrix): the writer edits their own
// comment; the writer or the post's author deletes it.

export function canEditComment(actor: AuthenticatedActor, comment: { authorId: string | null }) {
  return comment.authorId === actor.id;
}

export function canDeleteComment(
  actor: AuthenticatedActor,
  comment: { authorId: string | null },
  postAuthorId: string | null,
) {
  return comment.authorId === actor.id || postAuthorId === actor.id;
}

/** A hidden comment (MOD-04) stays visible to the person who wrote it. */
export function canSeeHidden(actor: AuthenticatedActor, comment: { authorId: string | null }) {
  return comment.authorId === actor.id;
}
