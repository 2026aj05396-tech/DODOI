"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "@/components/ui/wordmark";
import { cn } from "@/lib/utils/cn";

const SECTIONS = [
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/themes", label: "Themes" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/reports", label: "Reports" },
] as const;

/** Admin top bar (not designed: built from the design system, P1-17). Scrolls sideways on phones. */
export function AdminHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border-faint bg-background">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3 md:px-8">
        <Link href="/admin/posts" className="flex shrink-0 items-center gap-2">
          <Wordmark />
          <span className="hidden rounded-full bg-inverse px-2 py-0.5 text-overline text-inverse-foreground uppercase sm:inline">
            Admin
          </span>
        </Link>
        <nav aria-label="Admin" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex gap-1">
            {SECTIONS.map((section) => {
              const current = pathname.startsWith(section.href);
              return (
                <li key={section.href}>
                  <Link
                    href={section.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "block rounded-full px-3.5 py-2 text-control whitespace-nowrap",
                      current
                        ? "bg-inverse font-bold text-inverse-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          href="/"
          className="hidden shrink-0 text-control font-bold text-link hover:underline md:block"
        >
          Back to dodoi
        </Link>
      </div>
    </header>
  );
}
