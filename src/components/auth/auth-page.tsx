import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { LandingCraftTiles } from "@/components/marketing/craft-tiles";
import { Skeleton } from "@/components/ui/skeleton";
import { Wordmark } from "@/components/ui/wordmark";

type AuthPageProps = {
  /** The page's h1. Omit it when the content renders its own (its heading changes in place). */
  title?: string;
  /** Rendered at request time (reads the session or URL), so it streams behind a skeleton. */
  children: ReactNode;
};

/**
 * Frame for the auth screens (P1-07). Only Welcome (1a) and Landing (2a) are designed; these are
 * built from the design system for PO review. Mobile: Welcome's single column (wordmark
 * top-left, 448px), centred vertically from 768px. From 1024px: the Landing collage in a panel
 * beside the form.
 */
export function AuthPage({ title, children }: AuthPageProps) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside
        aria-hidden
        className="hidden flex-col justify-center gap-8 bg-card/60 px-14 py-12 lg:flex"
      >
        <LandingCraftTiles rowClassName="auto-rows-[88px] xl:auto-rows-[104px]" />
        <div className="flex flex-col gap-2">
          <p className="text-title-web text-balance text-foreground">
            Share progress, not perfection.
          </p>
          <p className="text-body-lg-web text-foreground-secondary">No experience needed.</p>
        </div>
      </aside>

      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 pt-5 pb-9 md:justify-center md:py-12">
        <Link href="/" aria-label="dodoi home" className="self-start rounded-sm">
          <Wordmark />
        </Link>
        <div className="flex flex-col gap-6">
          {title ? <h1 className="text-title text-balance text-foreground">{title}</h1> : null}
          <Suspense fallback={<Skeleton className="h-72 w-full rounded-md" />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
