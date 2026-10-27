"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { listAdminPosts } from "@/lib/api-client/admin";
import { ApiRequestError } from "@/lib/api-client/request";
import type { AdminPostSummary } from "@/lib/types/admin";
import type { Paginated } from "@/lib/types/api";

import { StatusBadge } from "./status-badge";

const FILTERS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PUBLISHED", label: "Published" },
  { value: "UNPUBLISHED", label: "Unpublished" },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  TEAM_ORIGINAL: "Team original",
  INVITED_CREATOR: "Invited creator",
  STOCK_LICENSED: "Stock",
  CREATIVE_COMMONS: "Creative Commons",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Admin post list (ADM-04): status filter, newest change first, "Load more". */
export function PostList({ initialPage }: { initialPage: Paginated<AdminPostSummary> }) {
  const [status, setStatus] = useState("");
  const [items, setItems] = useState(initialPage.items);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(nextStatus: string, nextCursor: string | null) {
    setPending(true);
    setError(null);
    try {
      const page = await listAdminPosts({ status: nextStatus, cursor: nextCursor });
      setItems((current) => (nextCursor ? [...current, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Couldn't load posts.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title text-foreground md:text-title-web">Posts</h1>
        <Button asChild>
          <Link href="/admin/posts/new">New post</Link>
        </Button>
      </div>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <ToggleChip
            key={filter.value}
            pressed={status === filter.value}
            onPressedChange={() => {
              setStatus(filter.value);
              void load(filter.value, null);
            }}
          >
            {filter.label}
          </ToggleChip>
        ))}
      </div>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      {items.length === 0 && !pending ? (
        <EmptyState
          title="No posts here yet"
          description="Create a post, or import the seed content."
          action={
            <Button asChild variant="outline">
              <Link href="/admin/posts/new">New post</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border-faint rounded-card border border-border-faint bg-card">
          {items.map((post) => (
            <li key={post.id}>
              <Link
                href={`/admin/posts/${post.id}`}
                className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 p-3 hover:bg-muted md:grid-cols-[72px_minmax(0,1fr)_140px_120px_120px] md:gap-4 md:px-4"
              >
                {post.coverMedia ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet.
                  <img
                    src={post.coverMedia.posterUrl ?? post.coverMedia.url}
                    srcSet={post.coverMedia.srcSet}
                    sizes="72px"
                    alt=""
                    className="aspect-square w-full rounded-md bg-muted object-cover"
                  />
                ) : (
                  <span aria-hidden className="aspect-square w-full rounded-md bg-muted" />
                )}
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-control-lg font-bold text-foreground">
                    {post.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-meta text-foreground-secondary md:hidden">
                    <StatusBadge status={post.status} />
                    {post.sourceType ? SOURCE_LABELS[post.sourceType] : "No attribution"}
                  </span>
                </span>
                <span className="hidden text-body text-foreground-secondary md:block">
                  {post.sourceType ? SOURCE_LABELS[post.sourceType] : "No attribution"}
                </span>
                <span className="hidden md:block">
                  <StatusBadge status={post.status} />
                </span>
                <span className="hidden text-body text-foreground-secondary md:block">
                  {formatDate(post.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={pending}
          onClick={() => load(status, cursor)}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
