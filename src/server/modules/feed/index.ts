// Public API of the feed module (CODE_QUALITY §3.2): ranked feed, filters, suggestion, feedback.
export { FEED_CONFIG } from "./config";
export {
  getFeed,
  getFeedFilters,
  getSkillSuggestion,
  markNotInterested,
  undoNotInterested,
} from "./service";
