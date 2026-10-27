import { Skeleton } from "@/components/ui/skeleton";

// Varied heights mimic the masonry so the layout doesn't jump when cards arrive.
const COLUMN_HEIGHTS = [
  ["h-52", "h-40", "h-60"],
  ["h-40", "h-64", "h-44"],
  ["h-56", "h-44", "h-52"],
];

/** Placeholder cards while the feed loads: 2 columns, 3 from 1280px. */
export function FeedSkeleton({ label = "Loading your feed" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex gap-3 md:gap-4">
      {COLUMN_HEIGHTS.map((heights, column) => (
        <div
          key={column}
          className={
            column === 2 ? "hidden flex-1 flex-col gap-5 xl:flex" : "flex flex-1 flex-col gap-5"
          }
        >
          {heights.map((height, index) => (
            <Skeleton key={index} className={`${height} w-full`} />
          ))}
        </div>
      ))}
    </div>
  );
}
