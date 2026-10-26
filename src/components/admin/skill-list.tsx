"use client";

import Link from "next/link";
import { useState } from "react";

import { ToggleChip } from "@/components/ui/chip";
import { SearchField } from "@/components/ui/search-field";

import { StatusBadge } from "./status-badge";

type SkillRow = {
  id: string;
  name: string;
  slug: string;
  origin: "PREDEFINED" | "CUSTOM";
  status: "ACTIVE" | "HIDDEN";
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "CUSTOM", label: "Custom" },
  { value: "HIDDEN", label: "Hidden" },
] as const;

/** Admin skill list (P1-17): every skill, filterable; custom ones can be reviewed and hidden. */
export function SkillList({ skills }: { skills: SkillRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const term = query.trim().toLowerCase();
  const shown = skills.filter(
    (skill) =>
      (!term || skill.name.toLowerCase().includes(term)) &&
      (filter === "all" ||
        (filter === "CUSTOM" ? skill.origin === "CUSTOM" : skill.status === "HIDDEN")),
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-title text-foreground md:text-title-web">Skills</h1>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchField
          label="Search skills"
          placeholder="Search skills"
          appearance="outline"
          className="md:w-80"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div role="group" aria-label="Filter skills" className="flex gap-2">
          {FILTERS.map((item) => (
            <ToggleChip
              key={item.value}
              pressed={filter === item.value}
              onPressedChange={() => setFilter(item.value)}
            >
              {item.label}
            </ToggleChip>
          ))}
        </div>
      </div>
      <p className="text-meta text-foreground-secondary">{shown.length} skills</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((skill) => (
          <li key={skill.id}>
            <Link
              href={`/admin/skills/${skill.id}`}
              className="flex items-center justify-between gap-2 rounded-md border border-border-faint bg-card p-3 hover:bg-muted"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-control font-bold text-foreground">
                  {skill.name}
                </span>
                <span className="text-meta text-foreground-secondary">
                  {skill.origin === "CUSTOM" ? "Custom" : "Predefined"}
                </span>
              </span>
              <StatusBadge status={skill.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
