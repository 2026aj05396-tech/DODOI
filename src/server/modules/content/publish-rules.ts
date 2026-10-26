import type { FieldErrors } from "@/server/lib/errors";

// What a post needs before it can be (or stay) published (P1-16; DC-25, OD-18, PO decisions):
// skills with an active primary, at least one photo or video, alt text on every image, and
// attribution that fits its source type.

export type PublishState = {
  skills: { skillId: string; isPrimary: boolean }[];
  /** Status of each of the post's skills. */
  skillStatuses: Map<string, "ACTIVE" | "HIDDEN">;
  media: { type: "IMAGE" | "VIDEO"; altText: string | null }[];
  stepMedia: { type: "IMAGE" | "VIDEO"; altText: string | null }[];
  attribution: {
    sourceType: string;
    license: string;
    attributionText: string;
    originalAuthor: string | null;
    originalUrl: string | null;
    permissionRef: string | null;
  } | null;
  authorId: string | null;
};

/** Creative Commons content is limited to CC BY and CC BY-SA, e.g. "CC BY 4.0" (no NC, no ND). */
const CREATIVE_COMMONS_LICENSE = /^CC BY(-SA)?( \d(\.\d)?)?$/i;

const missingAlt = (items: PublishState["media"]) =>
  items.some((item) => item.type === "IMAGE" && !item.altText?.trim());

/** Field errors that block publishing; empty when the post can be published. */
export function publishProblems(state: PublishState): FieldErrors {
  const problems: FieldErrors = {};

  const primary = state.skills.find((skill) => skill.isPrimary);
  if (state.skills.length === 0) problems.skillIds = "Add at least one skill.";
  else if (!primary) problems.primarySkillId = "Choose the main skill.";
  else if (state.skillStatuses.get(primary.skillId) !== "ACTIVE") {
    problems.primarySkillId = "The main skill is hidden. Choose another one.";
  }

  if (state.media.length === 0) problems.mediaIds = "Add at least one photo or video.";
  else if (missingAlt(state.media)) problems.mediaIds = "Every photo needs alt text.";
  if (missingAlt(state.stepMedia)) problems.steps = "Every step photo needs alt text.";

  Object.assign(problems, attributionProblems(state.attribution, state.authorId));
  return problems;
}

/**
 * Attribution problems for its source type (also checked on every seed import, published or not):
 * Creative Commons only CC BY / CC BY-SA with author and link, stock with a link, invited creators
 * with an account and a permission reference, no creator account for other sources.
 */
export function attributionProblems(
  attribution: PublishState["attribution"],
  authorId: string | null,
): FieldErrors {
  const problems: FieldErrors = {};
  if (!attribution) {
    problems.attribution = "Add where this post comes from and its licence.";
  } else {
    if (attribution.sourceType === "CREATIVE_COMMONS") {
      if (!CREATIVE_COMMONS_LICENSE.test(attribution.license.trim())) {
        problems["attribution.license"] = "Creative Commons posts must be CC BY or CC BY-SA.";
      }
      if (!attribution.originalAuthor) {
        problems["attribution.originalAuthor"] = "Add the original author.";
      }
      if (!attribution.originalUrl) problems["attribution.originalUrl"] = "Add the source link.";
    }
    if (attribution.sourceType === "STOCK_LICENSED" && !attribution.originalUrl) {
      problems["attribution.originalUrl"] = "Add the source link.";
    }
    if (attribution.sourceType === "INVITED_CREATOR") {
      if (!authorId) problems.authorUsername = "Choose the creator's dodoi account.";
      if (!attribution.permissionRef) {
        problems["attribution.permissionRef"] =
          "Add a reference to the creator's written permission.";
      }
    } else if (authorId) {
      problems.authorUsername = "Only invited-creator posts have a creator account.";
    }
  }
  return problems;
}
