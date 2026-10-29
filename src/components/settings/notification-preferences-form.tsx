"use client";

import { useState } from "react";

import { showToast } from "@/components/ui/toast";
import { saveNotificationPreferences } from "@/lib/api-client/notifications";
import { ApiRequestError } from "@/lib/api-client/request";
import type { NotificationPreferences, NotificationTypeName } from "@/lib/types/notifications";

// Notification settings (P2-07, NTF-04): one switch per type, all on by default, saved as soon as
// one changes.

const OPTIONS: { type: NotificationTypeName; label: string; description: string }[] = [
  { type: "COMMENT", label: "Comments", description: "Someone comments on your post" },
  { type: "REPLY", label: "Replies", description: "Someone replies to your comment" },
  { type: "FOLLOW", label: "New followers", description: "Someone follows you" },
  { type: "LIKE", label: "Likes", description: "Someone likes your post" },
];

export function NotificationPreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const [preferences, setPreferences] = useState(initial);

  async function change(type: NotificationTypeName, enabled: boolean) {
    setPreferences((current) => ({ ...current, [type]: enabled }));
    try {
      await saveNotificationPreferences({ [type]: enabled });
    } catch (error) {
      setPreferences((current) => ({ ...current, [type]: !enabled }));
      showToast({
        message: error instanceof ApiRequestError ? error.message : "We couldn't save that.",
      });
    }
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-background">
      {OPTIONS.map(({ type, label, description }) => (
        <li key={type}>
          <label className="flex min-h-16 cursor-pointer items-center gap-3.5 px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-control-lg font-bold text-foreground">{label}</span>
              <span className="text-meta text-foreground-secondary">{description}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={preferences[type]}
              onChange={(event) => void change(type, event.target.checked)}
              className="size-5 shrink-0 accent-[var(--color-foreground)]"
            />
          </label>
        </li>
      ))}
    </ul>
  );
}
