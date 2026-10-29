// Feed tuning (SYSTEM_ARCHITECTURE §7; PO approved 2026-10-26, P1-21). Every number the ranking
// uses lives here so it can be tuned without touching the rules.

export const FEED_CONFIG = {
  /** interestMatch: per post skill among the user's interests. */
  interestMatchPerSkill: 3,
  /** levelFit: post difficulty at most one step above the user's level for its main skill. */
  levelFit: 1,
  /** Users who gave no level for a skill count as Curious. */
  defaultLevel: "CURIOUS",
  /** freshness by post age. */
  freshness: [
    { maxAgeDays: 7, points: 2 },
    { maxAgeDays: 30, points: 1 },
  ],
  /** followBoost: a post by a maker the user follows (FLW-04; PROPOSED, PO to confirm the size). */
  followBoost: 4,
  /** saveAffinity: per post skill found in the user's recent saves. */
  saveAffinityPerSkill: 1,
  /** negativeFeedbackPenalty: per post skill of posts the user marked "Not interested". */
  notInterestedPenaltyPerSkill: 2,
  /** How far back saves and "Not interested" count. */
  recentSignalDays: 30,
  /** Share of each For you page drawn from skills outside the user's interests (FEED-11). */
  discoveryShare: 0.2,
  /** At most this many items in a row with the same main skill. */
  maxSameSkillInARow: 2,
  /** Feed sessions (no repeats, FEED-09) expire after this long. */
  sessionHours: 24,
  /** Expired sessions and their impressions are kept this long, then purged (DATABASE_SCHEMA §7). */
  expiredSessionRetentionDays: 7,
  /** Newest published posts considered per page. */
  candidateLimit: 1000,
  /** Interest chips in the filter bar (FEED-13), most recently added first. */
  maxInterestChips: 5,
  /** "N beginner projects under an hour" on the suggestion card (FEED-14). */
  quickProjectMinutes: 60,
} as const;
