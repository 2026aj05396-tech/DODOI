"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Ends this device's session and returns to the landing page. */
export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await signOut({ redirectTo: "/" });
  }

  return (
    <Button variant="outline" size="lg" onClick={handleClick} disabled={pending}>
      Sign out
    </Button>
  );
}
