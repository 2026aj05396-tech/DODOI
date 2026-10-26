import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder while an admin page loads: title line and a block for the list or editor. Each admin
 * page wraps its data in its own `<Suspense>` with this fallback, because the admin layout's
 * boundary does not cover client navigations between admin pages (Next.js instant navigation).
 */
export function AdminPageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-5">
      <Skeleton className="h-8 w-48 rounded-md" />
      <Skeleton className="h-96 w-full rounded-md" />
    </div>
  );
}
