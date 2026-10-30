import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder while a chat loads: a question, an answer and a longer answer. */
export function ChatSkeleton() {
  return (
    <div role="status" aria-label="Loading the chat" className="flex flex-1 flex-col gap-3 p-5">
      <Skeleton className="h-12 w-2/3 max-w-sm" />
      <Skeleton className="h-24 w-4/5 max-w-md self-end" />
      <Skeleton className="h-32 w-full max-w-lg" />
    </div>
  );
}
