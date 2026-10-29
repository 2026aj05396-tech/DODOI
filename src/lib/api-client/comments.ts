import type { Paginated } from "@/lib/types/api";
import type { Comment } from "@/lib/types/comments";

import { postJson, requestJson } from "./request";

// Comments (API_SPECIFICATION §9.1, P2-04).

function withCursor(path: string, cursor: string | null): string {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
}

export function listComments(postId: string, cursor: string | null): Promise<Paginated<Comment>> {
  return requestJson<Paginated<Comment>>(
    "GET",
    withCursor(`/api/posts/${postId}/comments`, cursor),
  );
}

export function listReplies(commentId: string, cursor: string | null): Promise<Paginated<Comment>> {
  return requestJson<Paginated<Comment>>(
    "GET",
    withCursor(`/api/comments/${commentId}/replies`, cursor),
  );
}

export function addComment(postId: string, body: string, parentId?: string): Promise<Comment> {
  return postJson<Comment>(`/api/posts/${postId}/comments`, { body, parentId });
}

export function editComment(id: string, body: string): Promise<Comment> {
  return requestJson<Comment>("PATCH", `/api/comments/${id}`, { body });
}

export function removeComment(id: string): Promise<void> {
  return requestJson("DELETE", `/api/comments/${id}`);
}
