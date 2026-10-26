import type { PostStatusName } from "@/lib/types/admin";
import { cn } from "@/lib/utils/cn";

const LABELS: Record<PostStatusName, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  UNPUBLISHED: "Unpublished",
};

/** Post status: a dot plus text, never colour alone (UI_UX_GUIDELINES §7). */
export function StatusBadge({ status }: { status: PostStatusName | "HIDDEN" | "ACTIVE" }) {
  const label = status === "HIDDEN" ? "Hidden" : status === "ACTIVE" ? "Active" : LABELS[status];
  const live = status === "PUBLISHED" || status === "ACTIVE";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-meta font-bold text-foreground">
      <span
        aria-hidden
        className={cn("size-2 rounded-full", live ? "bg-success" : "bg-muted-foreground")}
      />
      {label}
    </span>
  );
}
