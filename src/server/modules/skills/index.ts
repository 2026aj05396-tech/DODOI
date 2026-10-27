// Public API of the skills module (CODE_QUALITY §3.2).
export {
  getAdminSkill,
  listAdminSkills,
  setRelatedSkills,
  updateAdminSkill,
  type AdminSkillListItem,
} from "./admin";
export {
  containsOffensiveWords,
  CUSTOM_SKILL_RATE_LIMIT,
  getActiveSkillSummaries,
  getSkillsForModeration,
  setSkillHidden,
  type ModerationSkill,
  getNewestSkills,
  getSkillsToTry,
  getSkillBySlug,
  getSkillsBySlugs,
  getSkillStatuses,
  getSuggestionCandidates,
  listPredefinedSkills,
  type SkillSuggestionCandidate,
  listSkills,
  resolveCustomSkill,
} from "./service";
export { seedPredefinedSkills, type PredefinedSkillsData, type SeedSkillsResult } from "./seed";
