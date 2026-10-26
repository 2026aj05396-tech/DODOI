// Public API of the content module (CODE_QUALITY §3.2): media, posts and themes.
export {
  deleteOrphanedMedia,
  getMedia,
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
  getBeginnerProjectCounts,
  getFeedCandidates,
  getPostCards,
  getPostDetail,
  getRelatedPosts,
  getTheme,
  isPostPublished,
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
  getAdminPost,
  getAdminTheme,
  listAdminPosts,
  listAdminThemes,
  publishPost,
  unpublishPost,
  updateAdminPost,
  updateAdminTheme,
} from "./admin-service";
export { getPostProgress, updatePostProgress } from "./progress-service";
export { importSeedContent, type SeedImportOutcome } from "./seed-import";
