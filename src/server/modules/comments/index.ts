// Public API of the comments module (CODE_QUALITY §3.2): comments and replies on posts (P2-04).
export {
  COMMENT_RATE_LIMIT,
  createComment,
  deleteComment,
  deleteCommentsOfUser,
  getCommentCount,
  getCommentsForModeration,
  listComments,
  listReplies,
  setCommentHidden,
  updateComment,
} from "./service";
