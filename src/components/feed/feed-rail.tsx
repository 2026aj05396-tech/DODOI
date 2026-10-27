import { Users, Video } from "lucide-react";

import { ComingSoonCard } from "@/components/ui/coming-soon";
import type { SkillSuggestion } from "@/lib/types/feed";

import { SkillSuggestionCard } from "./skill-suggestion-card";

// Desktop right rail (`2b`, ≥ 1280px): the "New to you" card, then "Help other makers" (P3) and
// "Live sessions" (P3) as coming-soon cards (roadmap P1-22).

export function FeedRail({ suggestion }: { suggestion: SkillSuggestion | null }) {
  return (
    <>
      {suggestion ? <SkillSuggestionCard suggestion={suggestion} /> : null}
      <ComingSoonCard
        title="Help other makers"
        description="Answer questions from people learning the skills you know."
        icon={<Users />}
      />
      <ComingSoonCard
        title="Live sessions"
        description="Book a 30-minute call with a maker. We'll let you know when this opens."
        icon={<Video />}
      />
    </>
  );
}
