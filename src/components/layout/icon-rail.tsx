"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "@/components/ui/wordmark";
import { cn } from "@/lib/utils/cn";

import {
  COMMUNITY,
  CREATE,
  EXPLORE,
  HOME,
  SAVED,
  isActivePath,
  profileNavItem,
  type NavItem,
} from "./nav-items";

const ITEM_CLASSES = "relative flex size-12 items-center justify-center rounded-md";

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = isActivePath(pathname, item.href);
  return (
    <Link
      href={item.href ?? "/"}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        ITEM_CLASSES,
        isActive ? "bg-blush text-foreground" : "text-foreground-secondary hover:bg-muted",
      )}
    >
      <Icon aria-hidden className="size-5" strokeWidth={isActive ? 2 : 1.7} />
    </Link>
  );
}

/**
 * 76px icon rail for tablets (`3c`) and, from Phase 4, detail pages with the docked companion
 * (`2c`). Reads the current path to highlight the active item. On pages whose address isn't known
 * while prerendering (dynamic routes), the app shell shows `IconRailView` with nothing highlighted
 * until the browser knows it (Next.js Cache Components needs a Suspense boundary there).
 */
export function IconRail({ username, className }: { username: string | null; className?: string }) {
  return <IconRailView username={username} className={className} pathname={usePathname()} />;
}

export function IconRailView({
  username,
  className,
  pathname,
}: {
  username: string | null;
  className?: string;
  pathname: string;
}) {
  const CreateIcon = CREATE.icon;

  return (
    <nav
      aria-label="Main"
      className={cn(
        "sticky top-0 flex h-dvh w-19 shrink-0 flex-col items-center gap-1.5 overflow-y-auto border-r border-border bg-background py-7 *:shrink-0",
        className,
      )}
    >
      <Link href={HOME.href ?? "/"} className="mb-3.5 rounded-sm">
        <Wordmark variant="monogram" />
      </Link>
      <RailLink item={HOME} pathname={pathname} />
      <RailLink item={EXPLORE} pathname={pathname} />
      <RailLink item={COMMUNITY} pathname={pathname} />
      <RailLink item={SAVED} pathname={pathname} />
      <RailLink item={profileNavItem(username)} pathname={pathname} />
      <Link
        href={CREATE.href ?? "/create"}
        aria-label={CREATE.label}
        className={cn(
          ITEM_CLASSES,
          "mt-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary-hover",
        )}
      >
        <CreateIcon aria-hidden className="size-5" strokeWidth={2.2} />
      </Link>
    </nav>
  );
}
