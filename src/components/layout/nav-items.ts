import {
  Bookmark,
  House,
  MessageSquare,
  NotebookPen,
  Plus,
  Search,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

// Destinations from the design (`1c`, `2b`, `3c`). Items without an `href` belong to later phases and
// render as "coming soon" (PRODUCT_REQUIREMENTS NAV-01…04): visible, never navigating, no API calls.

export type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Omitted for features that are not built yet. */
  href?: string;
};

export const HOME: NavItem = { key: "home", label: "Home", icon: House, href: "/feed" };
export const EXPLORE: NavItem = {
  key: "explore",
  label: "Explore",
  icon: Search,
  href: "/explore",
};
export const SAVED: NavItem = { key: "saved", label: "Saved", icon: Bookmark, href: "/saved" };
/** Live from P2-02: opens the Create post flow (F-17). */
export const CREATE: NavItem = { key: "create", label: "Create", icon: Plus, href: "/create" };
export const COMMUNITY: NavItem = { key: "community", label: "Community", icon: Users };
export const MESSAGES: NavItem = { key: "messages", label: "Messages", icon: MessageSquare };
/** Live from P2-03: the creative journal (F-18). */
export const JOURNAL: NavItem = {
  key: "journal",
  label: "Journal",
  icon: NotebookPen,
  href: "/journal",
};

/**
 * Profile links to the user's public profile. The shell usually doesn't know the username (it is
 * static), so it links to `/profile`, which forwards to `/u/{username}` (P1-14).
 */
export function profileNavItem(username: string | null): NavItem {
  return {
    key: "profile",
    label: "Profile",
    icon: User,
    href: username ? `/u/${username}` : "/profile",
  };
}

/** True when `pathname` is the item's page or one of its sub-pages. */
export function isActivePath(pathname: string, href: string | undefined): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
