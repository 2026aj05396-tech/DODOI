// Public API of the likes module (CODE_QUALITY §3.2): one like per user per post (P2-05).
export { getPostLikeState, LIKE_RATE_LIMIT, likePost, unlikePost } from "./service";
