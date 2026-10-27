// Skill views returned by the API (API_SPECIFICATION §2, §4).

export type SkillAccentName = "BUTTER" | "BLUSH" | "LAVENDER" | "MINT" | "SKY" | "CORAL";

export type SkillSummary = {
  id: string;
  name: string;
  slug: string;
  accent: SkillAccentName;
  origin: "PREDEFINED" | "CUSTOM";
  /** Editor-set tag for skill cards, e.g. "Pairs with drawing" (SRCH-08). */
  hint: string | null;
};

/** Skill page data. `coverMedia` is added with the media integration (P1-03). */
export type SkillDetail = SkillSummary & {
  description: string | null;
  hint: string | null;
  pitch: string | null;
  relatedSkills: SkillSummary[];
};
