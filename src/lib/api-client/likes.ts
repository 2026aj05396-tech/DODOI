import { requestJson } from "./request";

// Likes (API_SPECIFICATION §9.1, P2-05).

export function likePost(postId: string): Promise<void> {
  return requestJson("PUT", `/api/posts/${postId}/like`);
}

export function unlikePost(postId: string): Promise<void> {
  return requestJson("DELETE", `/api/posts/${postId}/like`);
}
