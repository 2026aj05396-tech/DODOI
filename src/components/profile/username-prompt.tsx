"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { updateMyProfile } from "@/lib/api-client/me";

// "Pick your username" (DC-26): on the owner's first visits to their profile, until they choose a
// username or dismiss it. Dismissing is remembered on the account (PO decision, P1-14).

export function UsernamePrompt({ username }: { username: string }) {
  const [isHidden, setIsHidden] = useState(false);
  if (isHidden) return null;

  async function dismiss() {
    setIsHidden(true);
    try {
      await updateMyProfile({ dismissUsernamePrompt: true });
    } catch {
      setIsHidden(false);
      showToast({ message: "We couldn't hide that. Try again." });
    }
  }

  return (
    <section
      aria-labelledby="username-prompt-title"
      className="relative flex flex-col gap-2 rounded-card bg-butter p-4 pr-12"
    >
      <h2 id="username-prompt-title" className="text-control-lg font-bold text-foreground">
        Pick your username
      </h2>
      <p className="text-body text-foreground">
        We made <strong>@{username}</strong> for you. Want something that feels more like you?
      </p>
      <Button asChild size="sm" className="self-start">
        <Link href="/settings/profile">Choose a username</Link>
      </Button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => void dismiss()}
        className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full text-foreground hover:bg-background/60"
      >
        <X aria-hidden className="size-5" />
      </button>
    </section>
  );
}
