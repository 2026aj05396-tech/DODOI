import { Skeleton } from "@/components/ui/skeleton";

// Varied heights mimic the masonry feed so the layout does not jump when cards arrive.
const CARD_HEIGHTS = ["h-52", "h-38", "h-64", "h-44", "h-56", "h-40"];

/** Placeholder while a signed-in page loads: greeting line, filter chips and a masonry of cards. */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex flex-col gap-4 px-5 pt-4 md:px-7 md:pt-6"
    >
      <Skeleton className="h-7 w-2/3 max-w-md rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <div className="columns-2 gap-2.5 md:gap-4 xl:columns-3">
        {CARD_HEIGHTS.map((heightClass, index) => (
          <Skeleton key={index} className={`mb-3 break-inside-avoid ${heightClass}`} />
        ))}
      </div>
    </div>
  );
}
