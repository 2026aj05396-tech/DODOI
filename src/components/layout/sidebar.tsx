"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogOutDialog } from "@/components/auth/log-out-dialog";
import { ComingSoonBadge } from "@/components/ui/coming-soon";
import { Wordmark } from "@/components/ui/wordmark";
import { cn } from "@/lib/utils/cn";

import { AskDodoiCard } from "./ask-dodoi";
import { ComingSoonTrigger } from "./coming-soon-trigger";
import {
  COMMUNITY,
  CREATE,
  EXPLORE,
  HOME,
  JOURNAL,
  MESSAGES,
  SAVED,
  isActivePath,
  profileNavItem,
  type NavItem,
} from "./nav-items";

const ITEM_CLASSES = "flex h-11 w-full items-center gap-3 rounded-md px-3 text-control-lg";

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = isActivePath(pathname, item.href);
  return (
    <Link
      href={item.href ?? "/"}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        ITEM_CLASSES,
        isActive
          ? "bg-blush font-bold text-foreground"
          : "text-foreground-secondary hover:bg-muted",
      )}
    >
      <Icon aria-hidden className="size-5" strokeWidth={isActive ? 1.9 : 1.7} />
      {item.label}
    </Link>
  );
}

function SidebarComingSoon({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <ComingSoonTrigger
      label={item.label}
      hasVisibleLabel
      className={cn(ITEM_CLASSES, "text-muted-foreground")}
    >
      <Icon aria-hidden className="size-5" strokeWidth={1.7} />
      {item.label}
      <ComingSoonBadge size="sm" decorative className="ml-auto" />
    </ComingSoonTrigger>
  );
}

/** Log out (`2b`), under the Ask dodoi card; asks first. */
function SidebarLogOut() {
  return (
    <LogOutDialog>
      <button
        type="button"
        className={cn(ITEM_CLASSES, "font-bold text-destructive hover:bg-destructive-surface")}
      >
        <LogOut aria-hidden className="size-5" strokeWidth={1.8} />
        Log out
      </button>
    </LogOutDialog>
  );
}

/**
 * Full desktop sidebar (`2b`), 232px. Reads the current path to highlight the active item. On pages
 * whose address isn't known while prerendering (dynamic routes), the app shell shows `SidebarView`
 * with nothing highlighted until the browser knows it (Next.js Cache Components needs a Suspense
 * boundary there).
 */
export function Sidebar({ username, className }: { username: string | null; className?: string }) {
  return <SidebarView username={username} className={className} pathname={usePathname()} />;
}

export function SidebarView({
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
        "sticky top-0 flex h-dvh w-58 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-background px-4 py-6 *:shrink-0",
        className,
      )}
    >
      <Link
        href={HOME.href ?? "/"}

        className="mb-5 self-start rounded-sm px-3"
      >
        <Wordmark />
      </Link>
      <SidebarLink item={HOME} pathname={pathname} />
      <SidebarLink item={EXPLORE} pathname={pathname} />
      <SidebarComingSoon item={COMMUNITY} />
      <SidebarComingSoon item={MESSAGES} />
      <SidebarLink item={SAVED} pathname={pathname} />
      <SidebarComingSoon item={JOURNAL} />
      <SidebarLink item={profileNavItem(username)} pathname={pathname} />
      <ComingSoonTrigger
        label={CREATE.label}
        hasVisibleLabel
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary/60 text-control-lg font-bold text-primary-foreground"
      >
        <CreateIcon aria-hidden className="size-4.5" strokeWidth={2.2} />
        {CREATE.label}
        <ComingSoonBadge size="sm" decorative />
      </ComingSoonTrigger>
      <div className="mt-auto flex flex-col gap-3 pt-6">
        <AskDodoiCard />
        <SidebarLogOut />
      </div>
    </nav>
  );
}
