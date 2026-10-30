"use client";

import { useState } from "react";

import { showToast } from "@/components/ui/toast";
import { updateMessageSettings } from "@/lib/api-client/messages";
import { ApiRequestError } from "@/lib/api-client/request";
import type { MessagePolicyName } from "@/lib/types/messages";
import { cn } from "@/lib/utils/cn";

// Settings → Messages (MSG-02, F-29 step 4): who can message me. Saved as soon as it changes.

const OPTIONS: { value: MessagePolicyName; label: string; description: string }[] = [
  {
    value: "EVERYONE",
    label: "Everyone",
    description: "Any verified maker can start a conversation with you.",
  },
  {
    value: "FOLLOWING",
    label: "People I follow",
    description: "Only makers you follow can start one. You can always answer people you write to.",
  },
  {
    value: "NOBODY",
    label: "No one",
    description:
      "Nobody can start a conversation. Existing ones stay, and you can still write first.",
  },
];

export function MessageSettingsForm({ initial }: { initial: MessagePolicyName }) {
  const [policy, setPolicy] = useState(initial);

  async function choose(next: MessagePolicyName) {
    const previous = policy;
    setPolicy(next);
    try {
      await updateMessageSettings(next);
      showToast({ message: "Saved" });
    } catch (error) {
      setPolicy(previous);
      showToast({
        message: error instanceof ApiRequestError ? error.message : "We couldn't change that.",
      });
    }
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-control-sm font-bold text-foreground">Who can message me</legend>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex cursor-pointer gap-3 rounded-card border p-4",
            policy === option.value ? "border-foreground bg-card" : "border-border",
          )}
        >
          <input
            type="radio"
            name="messagePolicy"
            value={option.value}
            checked={policy === option.value}
            onChange={() => void choose(option.value)}
            className="mt-1 size-4.5 shrink-0 accent-[var(--color-foreground)]"
          />
          <span className="flex flex-col gap-1">
            <span className="text-control-lg font-bold text-foreground">{option.label}</span>
            <span className="text-body text-foreground-secondary">{option.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
