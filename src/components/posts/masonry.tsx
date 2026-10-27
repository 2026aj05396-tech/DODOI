"use client";

import type { ReactNode } from "react";

import { MasonrySkeleton } from "./masonry-skeleton";
import { useColumnCount } from "./use-column-count";

// Masonry grid (FEED-01, UI_UX_GUIDELINES §3): 2 columns, 3 from 1280px. Each item goes into the
// shortest column so far, using its known height, so items added later never move earlier ones.
// Shows the skeleton until the browser knows the width.

export function Masonry<T>({
  items,
  getKey,
  getHeight,
  renderItem,
  columns: fixedColumns,
}: {
  items: T[];
  getKey: (item: T) => string;
  /** Relative height (1 = as tall as the column is wide). */
  getHeight: (item: T) => number;
  renderItem: (item: T) => ReactNode;
  /** Overrides the responsive count (e.g. the feed drops the in-feed suggestion at 3). */
  columns?: number;
}) {
  const responsive = useColumnCount();
  const count = fixedColumns ?? responsive;
  if (count === null) return <MasonrySkeleton />;

  const columns: T[][] = Array.from({ length: count }, () => []);
  const heights = new Array<number>(count).fill(0);
  for (const item of items) {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest]?.push(item);
    heights[shortest] = (heights[shortest] ?? 0) + getHeight(item);
  }

  return (
    <div className="flex items-start gap-3 md:gap-4">
      {columns.map((column, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col gap-5">
          {column.map((item) => (
            <div key={getKey(item)}>{renderItem(item)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Height of a post card: its cover (kept between 3:4 and 4:3) plus about 0.3 for the text. */
export function cardHeight(width: number, height: number): number {
  if (height === 0) return 1.3;
  return 1 / Math.min(4 / 3, Math.max(3 / 4, width / height)) + 0.3;
}
