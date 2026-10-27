"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api-client/request";
import { setInterest } from "@/lib/api-client/skills";

// "Add to my interests" on a skill page (PO decision, P1-26): the feed picks it up on its next
// load. Removing keeps at least 3 interests (the server says so if not).

export function InterestToggle({
  skillId,
  skillName,
  initial,
}: {
  skillId: string;
  skillName: string;
  initial: boolean;
}) {
  const [isInterest, setIsInterest] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);

  async function toggle() {
    const next = !isInterest;
    setIsInterest(next);
    setIsSaving(true);
    try {
      await setInterest(skillId, next);
      showToast({
        message: next
          ? `${skillName} is in your interests. Your feed will follow.`
          : `Removed ${skillName} from your interests.`,
      });
    } catch (error) {
      setIsInterest(!next);
      showToast({
        message:
          error instanceof ApiRequestError ? error.message : "We couldn't update your interests.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Button
      variant={isInterest ? "outline" : "primary"}
      disabled={isSaving}
      onClick={() => void toggle()}
    >
      {isInterest ? (
        <Check aria-hidden className="size-4.5" />
      ) : (
        <Plus aria-hidden className="size-4.5" />
      )}
      {isInterest ? "In your interests" : "Add to my interests"}
    </Button>
  );
}
