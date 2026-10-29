// Public API of the content module (CODE_QUALITY §3.2): media, posts and themes.
export {
  avatarUrl,
  deleteOrphanedMedia,
  getOwnAvatar,
  getMedia,
  getMediaMap,
  getOwnedMediaIds,
  MEDIA_SIGN_RATE_LIMIT,
  mediaFolder,
  ORPHAN_MEDIA_AGE_MS,
  registerMedia,
  signMediaUpload,
  toMedia,
  updateMedia,
} from "./media-service";
export { checkDeclaredUpload, checkUploadedAsset, limitsFor } from "./media-rules";
export {
  getBeginnerPostIds,
  getBeginnerProjectCounts,
  getPublishedPostCountsBySkill,
  getFeedCandidates,
  getPostCards,
  getPostDetail,
  getPublishedPostAuthor,
  getRelatedPosts,
  getTheme,
  isPostPublished,
  searchPostIds,
  listSkillPosts,
  listThemes,
  refreshPostSearchIndex,
  RELATED_POSTS_LIMIT,
  type FeedCandidate,
} from "./post-service";
export {
  createAdminPost,
  createAdminTheme,
  deleteAdminPost,
  deleteAdminTheme,
  deleteContentOfUser,
  deleteUnusedMedia,
  getAdminPost,
  getAdminTheme,
  listAdminPosts,
  listAdminThemes,
  publishPost,
  unpublishPost,
  updateAdminPost,
  updateAdminTheme,
} from "./admin-service";
export { getSeedCoverage } from "./coverage-service";
export {
  createOwnPost,
  deleteOwnPost,
  getOwnPost,
  listOwnPosts,
  listProfilePosts,
  MAX_DRAFTS,
  OWN_POST_PUBLISH_RATE_LIMIT,
  publishOwnPost,
  toTag,
  updateOwnPost,
} from "./own-post-service";
export { getPostProgress, updatePostProgress } from "./progress-service";
export { importSeedContent, type SeedImportOutcome, type SeedPostSummary } from "./seed-import";
export { computeSeedCoverage, type CoveragePost } from "./seed-coverage";
