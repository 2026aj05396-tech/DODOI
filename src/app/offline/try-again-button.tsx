"use client";

import { Button } from "@/components/ui/button";

/** Loads the page the visitor asked for again (the address bar still shows it). */
export function TryAgainButton() {
  return <Button onClick={() => window.location.reload()}>Try again</Button>;
}
