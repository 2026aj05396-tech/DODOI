import type { UpdatePostProgressInput } from "@/lib/schemas/posts";
import type { PostProgress } from "@/lib/types/posts";

import { requestJson } from "./request";

// Posts (API_SPECIFICATION §5).

export function savePostProgress(
  postId: string,
  input: UpdatePostProgressInput,
): Promise<PostProgress> {
  return requestJson<PostProgress>("PUT", `/api/posts/${postId}/progress`, input);
}
