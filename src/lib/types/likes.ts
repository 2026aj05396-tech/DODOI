// The signed-in user's like on a post (API_SPECIFICATION §9.1, P2-05).

export type PostLikeState = {
  isLiked: boolean;
  /** Only the post's author gets the count (LIKE-02); null for everyone else. */
  likeCount: number | null;
};
