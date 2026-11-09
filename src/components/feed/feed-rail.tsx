import { HelpRailCard } from "@/components/community/help-rail-card";
import { SessionsRailCard } from "@/components/sessions/sessions-rail-card";
import type { SkillSuggestion } from "@/lib/types/feed";
import type { HelpRequestCard } from "@/lib/types/help";

import { SkillSuggestionCard } from "./skill-suggestion-card";

// Desktop right rail (`2b`, ≥ 1280px): the "New to you" card, "Help other makers" (live from
// P3-03) and "Live sessions" (live from P3-04; opens the person picker).

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
      <SessionsRailCard />
    </>
  );
}
