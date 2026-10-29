import "server-only";

import type { PostLikeState } from "@/lib/types/likes";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/server/lib/errors";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";
import { getPublishedPostAuthor } from "@/server/modules/content";

import { countLikes, deleteLike, hasLike, insertLike } from "./repository";

// Likes (P2-05; PRODUCT_REQUIREMENTS LIKE-01…03, API_SPECIFICATION §9.1). One like per user per
// post. The liker sees their own state; the count belongs to the post's author alone.

/** SECURITY_AND_PRIVACY §6: 200 likes (and unlikes) an hour per user. */
export const LIKE_RATE_LIMIT: RateLimitRule = { name: "like", limit: 200, windowSeconds: 60 * 60 };

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

/** Throws 404 unless the post is published; returns who wrote it. */
async function requirePublishedPost(postId: string): Promise<{ authorId: string | null }> {
  const post = await getPublishedPostAuthor(postId);
  if (!post) throw new NotFoundError("We couldn't find that post.");
  return post;
}

/** The viewer's like on a post and, for the post's author, how many likes it has. */
export async function getPostLikeState(actor: Actor, postId: string): Promise<PostLikeState> {
  const user = requireSignedIn(actor);
  const post = await requirePublishedPost(postId);
  const [isLiked, likeCount] = await Promise.all([
    hasLike(postId, user.id),
    post.authorId === user.id ? countLikes(postId) : null,
  ]);
  return { isLiked, likeCount };
}

/** PUT /api/posts/{postId}/like: idempotent; needs a verified email (OD-08). */
export async function likePost(actor: Actor, postId: string): Promise<void> {
  const user = requireSignedIn(actor);
  if (!user.isEmailVerified) {
    throw new ForbiddenError("Verify your email to like posts.", { code: "EMAIL_NOT_VERIFIED" });
  }
  await requirePublishedPost(postId);
  await enforceRateLimit(LIKE_RATE_LIMIT, user.id);
  await insertLike(postId, user.id);
}

/** DELETE /api/posts/{postId}/like: idempotent. */
export async function unlikePost(actor: Actor, postId: string): Promise<void> {
  const user = requireSignedIn(actor);
  await requirePublishedPost(postId);
  await enforceRateLimit(LIKE_RATE_LIMIT, user.id);
  await deleteLike(postId, user.id);
}
