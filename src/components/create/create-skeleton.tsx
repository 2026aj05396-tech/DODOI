import { Skeleton } from "@/components/ui/skeleton";

/** While the Create flow loads (signed-in check, skills, the draft). */
export function CreateSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="min-h-dvh bg-paper">
      <div className="h-14 border-b border-border-faint md:h-16" />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-6 md:px-8 md:py-10">
        <Skeleton className="h-[60svh] w-full rounded-xl md:h-[28rem]" />
      </div>
    </div>
  );
}
