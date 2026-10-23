// Public API of the skills module (CODE_QUALITY §3.2).
export { CUSTOM_SKILL_RATE_LIMIT, getSkillBySlug, listSkills, resolveCustomSkill } from "./service";
export { seedPredefinedSkills, type PredefinedSkillsData, type SeedSkillsResult } from "./seed";
