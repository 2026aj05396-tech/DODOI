"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { showToast } from "@/components/ui/toast";
import { updateMyProfile } from "@/lib/api-client/me";
import { ApiRequestError } from "@/lib/api-client/request";
import type { ProfileVisibility } from "@/lib/types/me";
import { cn } from "@/lib/utils/cn";

// Privacy (PRF-06, OD-10): public (default) or private profile. Saved as soon as it changes.

const OPTIONS: { value: ProfileVisibility; label: string; description: string }[] = [
  {
    value: "PUBLIC",
    label: "Public",
    description: "Signed-in makers can see your bio, skills and public collections.",
  },
  {
    value: "PRIVATE",
    label: "Private",
    description:
      "Others see only your name, username and photo. You're left out of maker search, and your public collections are hidden.",
  },
];

export function PrivacyForm({ initial }: { initial: ProfileVisibility }) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(initial);

  async function choose(next: ProfileVisibility) {
    const previous = visibility;
    setVisibility(next);
    try {
      await updateMyProfile({ visibility: next });
      showToast({
        message: next === "PRIVATE" ? "Your profile is private" : "Your profile is public",
      });
      router.refresh();
    } catch (error) {
      setVisibility(previous);
      showToast({
        message: error instanceof ApiRequestError ? error.message : "We couldn't change that.",
      });
    }
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-control-sm font-bold text-foreground">
        Who can see your profile
      </legend>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex cursor-pointer gap-3 rounded-card border p-4",
            visibility === option.value ? "border-foreground bg-card" : "border-border",
          )}
        >
          <input
            type="radio"
            name="visibility"
            value={option.value}
            checked={visibility === option.value}
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
