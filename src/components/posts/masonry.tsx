"use client";

import type { ReactNode } from "react";

import { useColumnCount } from "./use-column-count";

// Masonry grid (FEED-01, UI_UX_GUIDELINES §3): 2 columns, 3 from 1280px. Each item goes into the
// shortest column so far, using its known height, so items added later never move earlier ones.
//
// The server can't know the width, so until the browser takes over both layouts are rendered and
// CSS shows the right one: the cards and their images are in the first HTML instead of appearing
// only after the JavaScript has run (LCP, P1-31). Afterwards only the matching layout keeps its
// cards; it stays at the same place in the tree, so nothing is mounted twice.

/** How many leading items load their images straight away (above the fold on every width). */
const EAGER_ITEMS = 4;

type ColumnsProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  getHeight: (item: T) => number;
  renderItem: (item: T, options: { isAboveFold: boolean }) => ReactNode;
};

function Columns<T>({
  count,
  items,
  getKey,
  getHeight,
  renderItem,
}: ColumnsProps<T> & { count: number }) {
  const columns: { item: T; index: number }[][] = Array.from({ length: count }, () => []);
  const heights = new Array<number>(count).fill(0);
  items.forEach((item, index) => {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest]?.push({ item, index });
    heights[shortest] = (heights[shortest] ?? 0) + getHeight(item);
  });

  return (
    <div className="flex items-start gap-3 md:gap-4">
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="flex min-w-0 flex-1 flex-col gap-5">
          {column.map(({ item, index }) => (
            <div key={getKey(item)}>{renderItem(item, { isAboveFold: index < EAGER_ITEMS })}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Masonry<T>({
  items,
  include,
  ...props
}: ColumnsProps<T> & {
  /** Leaves an item out of one layout (the feed's suggestion moves to the rail at 3 columns). */
  include?: (item: T, columns: 2 | 3) => boolean;
}) {
  const count = useColumnCount();
  const itemsFor = (columns: 2 | 3) =>
    include ? items.filter((item) => include(item, columns)) : items;

  return (
    <>
      <div className="xl:hidden">
        {count !== 3 ? <Columns count={2} items={itemsFor(2)} {...props} /> : null}
      </div>
      <div className="hidden xl:block">
        {count !== 2 ? <Columns count={3} items={itemsFor(3)} {...props} /> : null}
      </div>
    </>
  );
}

/** Height of a post card: its cover (kept between 3:4 and 4:3) plus about 0.3 for the text. */
export function cardHeight(width: number, height: number): number {
  if (height === 0) return 1.3;
  return 1 / Math.min(4 / 3, Math.max(3 / 4, width / height)) + 0.3;
}
