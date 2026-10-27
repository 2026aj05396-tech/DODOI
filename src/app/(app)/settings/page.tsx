import { ChevronRight, Lock, Sparkles, User, UserCog } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SettingsFrame } from "@/components/settings/settings-frame";

export const metadata: Metadata = {
  title: "Settings · dodoi",
};

const SECTIONS = [
  {
    href: "/settings/profile",
    icon: User,
    title: "Edit profile",
    description: "Photo, name, username and bio",
  },
  {
    href: "/settings/skills",
    icon: Sparkles,
    title: "Your skills",
    description: "Interests, can help with, want to learn",
  },
  {
    href: "/settings/privacy",
    icon: Lock,
    title: "Privacy",
    description: "Who can see your profile",
  },
  {
    href: "/settings/account",
    icon: UserCog,
    title: "Account",
    description: "Email, password, sign out",
  },
];

// Settings (P1-14, USER_FLOWS F-10; not designed, built from the system).
export default function SettingsPage() {
  return (
    <SettingsFrame title="Settings" backHref="/profile" backLabel="Profile">
      <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-background">
        {SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-16 items-center gap-3.5 px-4 py-3 hover:bg-muted"
            >
              <Icon aria-hidden className="size-5 shrink-0 text-foreground-secondary" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-control-lg font-bold text-foreground">{title}</span>
                <span className="text-meta text-foreground-secondary">{description}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-foreground-secondary" />
            </Link>
          </li>
        ))}
      </ul>
    </SettingsFrame>
  );
}
