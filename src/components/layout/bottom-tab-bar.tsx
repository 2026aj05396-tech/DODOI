"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ComingSoonBadge } from "@/components/ui/coming-soon";
import { cn } from "@/lib/utils/cn";

import { ComingSoonTrigger } from "./coming-soon-trigger";
import {
  COMMUNITY,
  CREATE,
  EXPLORE,
  HOME,
  isActivePath,
  profileNavItem,
  type NavItem,
} from "./nav-items";

function TabLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = isActivePath(pathname, item.href);
  return (
    <Link
      href={item.href ?? "/"}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md py-1 text-tab",
        isActive ? "font-bold text-link" : "text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="size-6" strokeWidth={isActive ? 2 : 1.7} />
      {item.label}
    </Link>
  );
}

function ComingSoonTab({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <ComingSoonTrigger
      label={item.label}
      hasVisibleLabel
      className="relative flex flex-col items-center gap-0.5 rounded-md py-1 text-tab text-muted-foreground"
    >
      <Icon aria-hidden className="size-6" strokeWidth={1.7} />
      {item.label}
      <ComingSoonBadge size="sm" decorative className="absolute -top-1 right-1" />
    </ComingSoonTrigger>
  );
}

/** Mobile bottom navigation (`1c`): Home · Explore · Create · Community · Profile. */
export function BottomTabBar({ username }: { username: string | null }) {
  const pathname = usePathname();
  const CreateIcon = CREATE.icon;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-muted bg-background px-2 pt-2 pb-[max(1.375rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="grid grid-cols-5 items-start">
        <TabLink item={HOME} pathname={pathname} />
        <TabLink item={EXPLORE} pathname={pathname} />
        <div className="flex justify-center">
          <ComingSoonTrigger
            label={CREATE.label}
            className="relative -mt-1 flex size-12 items-center justify-center rounded-lg bg-primary/60 text-primary-foreground"
          >
            <CreateIcon aria-hidden className="size-6" strokeWidth={2.2} />
            <ComingSoonBadge size="sm" decorative className="absolute -top-1.5 -right-2" />
          </ComingSoonTrigger>
        </div>
        <ComingSoonTab item={COMMUNITY} />
        <TabLink item={profileNavItem(username)} pathname={pathname} />
      </div>
    </nav>
  );
}
