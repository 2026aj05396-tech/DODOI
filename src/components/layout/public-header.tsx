"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

/**
 * Slim bar for signed-out visitors on public pages (post detail, OD-29; PO decision P1-20): the
 * wordmark, "Log in" (back to this page afterwards) and "Sign up".
 */
export function PublicHeader() {
  const pathname = usePathname();
  return (
    <header className="flex h-14 items-center justify-between border-b border-border-faint bg-background px-4 md:h-16 md:px-7">
      <Link href="/" className="rounded-sm">
        <Wordmark className="text-2xl" />
      </Link>
      <nav aria-label="Account" className="flex items-center gap-4">
        <Button asChild variant="text">
          <Link href={`/sign-in?returnTo=${encodeURIComponent(pathname)}`}>Log in</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/sign-up">Sign up</Link>
        </Button>
      </nav>
    </header>
  );
}
