"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { clearOfflineData } from "@/lib/utils/clear-offline-data";

/** Ends this device's session, deletes what was kept for offline use, and returns to the landing page. */
export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await clearOfflineData();
    await signOut({ redirectTo: "/" });
  }

  return (
    <Button variant="outline" size="lg" onClick={handleClick} disabled={pending}>
      Sign out
    </Button>
  );
}
