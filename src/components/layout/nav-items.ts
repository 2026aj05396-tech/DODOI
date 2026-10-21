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
export const CREATE: NavItem = { key: "create", label: "Create", icon: Plus };
export const COMMUNITY: NavItem = { key: "community", label: "Community", icon: Users };
export const MESSAGES: NavItem = { key: "messages", label: "Messages", icon: MessageSquare };
export const JOURNAL: NavItem = { key: "journal", label: "Journal", icon: NotebookPen };

/** Profile links to the signed-in user's public profile; without a user it leads to sign-in. */
export function profileNavItem(username: string | null): NavItem {
  return {
    key: "profile",
    label: "Profile",
    icon: User,
    href: username ? `/u/${username}` : "/sign-in",
  };
}

/** True when `pathname` is the item's page or one of its sub-pages. */
export function isActivePath(pathname: string, href: string | undefined): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
