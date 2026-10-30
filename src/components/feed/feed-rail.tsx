import { Video } from "lucide-react";

import { HelpRailCard } from "@/components/community/help-rail-card";
import { ComingSoonCard } from "@/components/ui/coming-soon";
import type { SkillSuggestion } from "@/lib/types/feed";
import type { HelpRequestCard } from "@/lib/types/help";

import { SkillSuggestionCard } from "./skill-suggestion-card";

// Desktop right rail (`2b`, ≥ 1280px): the "New to you" card, "Help other makers" (live from
// P3-03) and "Live sessions" (coming soon until P3-04).

export function FeedRail({
  suggestion,
  helpRequests,
  hasCanHelpSkills,
}: {
  suggestion: SkillSuggestion | null;
  helpRequests: HelpRequestCard[];
  hasCanHelpSkills: boolean;
}) {
  return (
    <>
      {suggestion ? <SkillSuggestionCard suggestion={suggestion} /> : null}
      <HelpRailCard requests={helpRequests} hasCanHelpSkills={hasCanHelpSkills} />
      <ComingSoonCard
        title="Live sessions"
        description="Book a 30-minute call with a maker. We'll let you know when this opens."
        icon={<Video />}
      />
    </>
  );
}
