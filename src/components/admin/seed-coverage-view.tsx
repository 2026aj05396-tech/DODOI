import { CircleAlert, CircleCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { SEED_MINIMUMS } from "@/lib/constants/seed-coverage";
import type { SeedCoverage } from "@/lib/types/seed-coverage";
import { cn } from "@/lib/utils/cn";
import { postTypeLabel } from "@/lib/utils/post-labels";

// Admin Coverage page (P1-19, OD-31): published content against the launch minimums. Not
// designed: built from the admin system (P1-17). Rows below the minimum come first in each
// section; status is text + icon, never colour alone.

type Row = {
  key: string;
  label: string;
  badge?: string;
  counts: string;
  met: boolean;
  need?: string;
};

function Status({ met, need }: { met: boolean; need?: string }) {
  return met ? (
    <span className="flex items-center gap-1.5 text-meta font-bold text-foreground-secondary">
      <CircleCheck aria-hidden className="size-4 text-success" />
      Met
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-meta font-bold text-destructive">
      <CircleAlert aria-hidden className="size-4" />
      {need}
    </span>
  );
}

function Section({
  title,
  rule,
  rows,
  empty,
}: {
  title: string;
  rule: string;
  rows: Row[];
  empty?: ReactNode;
}) {
  const met = rows.filter((row) => row.met).length;
  const ordered = [...rows.filter((row) => !row.met), ...rows.filter((row) => row.met)];
  return (
    <section aria-labelledby={`coverage-${title}`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`coverage-${title}`} className="text-section text-foreground">
          {title}{" "}
          <span className="text-body font-normal text-foreground-secondary">
            {met} of {rows.length} met
          </span>
        </h2>
        <p className="text-meta text-foreground-secondary">{rule}</p>
      </div>
      {rows.length === 0 ? (
        empty
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((row) => (
            <li
              key={row.key}
              className={cn(
                "flex flex-col gap-1 rounded-md border bg-card p-3",
                row.met ? "border-border-faint" : "border-destructive-border",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 truncate text-control font-bold text-foreground">
                  {row.label}
                </span>
                {row.badge ? (
                  <span className="shrink-0 rounded-full bg-lavender px-2 py-0.5 text-tab font-bold text-plum">
                    {row.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-meta text-foreground-secondary">{row.counts}</span>
              <Status met={row.met} need={row.need} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const more = (have: number, min: number, what: string) =>
  have < min ? `${min - have} more ${what}` : null;

export function SeedCoverageView({ coverage }: { coverage: SeedCoverage }) {
  const skills: Row[] = coverage.skills.map((row) => ({
    key: row.slug,
    label: row.name,
    badge: row.focus ? "Focus" : undefined,
    counts: row.focus
      ? `${row.posts}/${row.minPosts} posts · ${row.tutorials}/${row.minTutorials} tutorials`
      : `${row.posts}/${row.minPosts} posts`,
    met: row.met,
    need:
      [more(row.posts, row.minPosts, "posts"), more(row.tutorials, row.minTutorials, "tutorials")]
        .filter(Boolean)
        .join(", ") || undefined,
  }));
  const types: Row[] = coverage.types.map((row) => ({
    key: row.type,
    label: postTypeLabel(row.type, null),
    counts: `${row.posts}/${row.min} posts`,
    met: row.met,
    need: more(row.posts, row.min, "posts") ?? undefined,
  }));
  const themes: Row[] = (coverage.themes ?? []).map((row) => ({
    key: row.slug,
    label: row.title,
    counts: `${row.posts}/${row.min} posts`,
    met: row.met,
    need: more(row.posts, row.min, "posts") ?? undefined,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-title text-foreground md:text-title-web">Coverage</h1>
        <p
          role="status"
          className={cn(
            "flex items-start gap-2.5 rounded-card p-4 text-body text-foreground",
            coverage.gaps === 0 ? "bg-mint" : "bg-destructive-surface",
          )}
        >
          {coverage.gaps === 0 ? (
            <>
              <CircleCheck aria-hidden className="mt-0.5 size-4.5 shrink-0 text-success" />
              Every launch minimum is met.
            </>
          ) : (
            <>
              <CircleAlert aria-hidden className="mt-0.5 size-4.5 shrink-0 text-destructive" />
              <span>
                <strong>
                  {coverage.gaps} {coverage.gaps === 1 ? "gap" : "gaps"}
                </strong>{" "}
                before launch. Counted from published posts; a post counts toward every skill it is
                tagged with.
              </span>
            </>
          )}
        </p>
        {coverage.missingFocusSkills.length > 0 ? (
          <p className="text-body text-destructive">
            Launch-focus skills not found (renamed or hidden?):{" "}
            {coverage.missingFocusSkills.join(", ")}
          </p>
        ) : null}
      </div>

      <Section
        title="Skills"
        rule={`${SEED_MINIMUMS.postsPerSkill} posts each · focus skills ${SEED_MINIMUMS.postsPerFocusSkill} posts incl. ${SEED_MINIMUMS.tutorialsPerFocusSkill} tutorials`}
        rows={skills}
      />
      <Section title="Post types" rule={`${SEED_MINIMUMS.postsPerType} posts each`} rows={types} />
      <Section
        title="Themes"
        rule={`${SEED_MINIMUMS.postsPerTheme} posts in each published theme`}
        rows={themes}
        empty={
          <p className="text-body text-foreground-secondary">
            No published themes yet.{" "}
            <Link href="/admin/themes" className="font-bold text-link hover:underline">
              Manage themes
            </Link>
          </p>
        }
      />
    </div>
  );
}
