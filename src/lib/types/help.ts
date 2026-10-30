import type { HelpStatusName } from "@/lib/schemas/help";
import type { Media } from "@/lib/types/media";
import type { CreatorSummary } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";

// Help request views returned by the API (API_SPECIFICATION §9.3, P3-03).

export type { HelpStatusName };

export type HelpRequestCard = {
  id: string;
  title: string;
  status: HelpStatusName;
  /** Null when the skill has since been hidden. */
  skill: Pick<SkillSummary, "id" | "name" | "slug" | "accent"> | null;
  /** Null when their profile is hidden or gone. */
  author: CreatorSummary | null;
  responseCount: number;
  isOwn: boolean;
  createdAt: string;
};

export type HelpResponseView = {
  id: string;
  body: string;
  author: CreatorSummary | null;
  isOwn: boolean;
  /** Set by the asker; a thank-you, never a score. */
  isHelpful: boolean;
  createdAt: string;
};

export type HelpRequestDetail = HelpRequestCard & {
  body: string;
  photos: Media[];
  responses: HelpResponseView[];
  /** A verified member who is not the asker, on a request that is not resolved. */
  canRespond: boolean;
  /** Only the viewer's own request and moderators can still open a hidden one. */
  isHidden: boolean;
};
