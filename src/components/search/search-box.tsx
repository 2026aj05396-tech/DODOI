"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SearchField } from "@/components/ui/search-field";
import { useIsOnline } from "@/hooks/use-is-online";
import { searchSkills } from "@/lib/api-client/skills";
import type { SkillSummary } from "@/lib/types/skills";
import { cn } from "@/lib/utils/cn";

// Search box (Explore `1d`, feed header `2b`, search page): Enter opens the results page; from 2
// characters it suggests matching skills underneath (APPROVED behaviour, roadmap §open decisions).
// Search needs the network (offline matrix): offline, the field is disabled and says so.

const MIN_SUGGEST = 2;
const SUGGESTIONS = 5;

export function SearchBox({
  defaultValue = "",
  appearance = "field",
  placeholder = "Skills, projects, makers",
  className,
}: {
  defaultValue?: string;
  appearance?: "field" | "outline";
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const [value, setValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SkillSummary[]>([]);
  const term = value.trim();

  useEffect(() => {
    if (term.length < MIN_SUGGEST) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchSkills(term, SUGGESTIONS)
        .then((page) => {
          if (!cancelled) setSuggestions(page.items);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const shown = isOpen && term.length >= MIN_SUGGEST ? suggestions : [];

  return (
    <form
      role="search"
      // Before hydration, Enter still opens the results page as a plain GET form.
      action="/search"
      method="get"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!term) return;
        setIsOpen(false);
        router.push(`/search?q=${encodeURIComponent(term)}`);
      }}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <SearchField
        label="Search skills, projects and makers"
        name="q"
        appearance={appearance}
        placeholder={isOnline ? placeholder : "Search needs a connection"}
        disabled={!isOnline}
        value={value}
        enterKeyHint="search"
        onChange={(event) => setValue(event.target.value)}
      />
      {shown.length > 0 ? (
        <ul
          aria-label="Suggested skills"
          className="absolute inset-x-0 top-full z-30 mt-1.5 flex flex-col overflow-hidden rounded-card border border-border bg-background py-1 shadow-float"
        >
          {shown.map((skill) => (
            <li key={skill.id}>
              <Link
                href={`/s/${skill.slug}`}
                onClick={() => setIsOpen(false)}
                className="flex min-h-11 items-center justify-between gap-3 px-4 text-control text-foreground hover:bg-muted"
              >
                {skill.name}
                <span className="text-meta text-foreground-secondary">Skill</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
