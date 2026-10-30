import { ComingSoonTrigger } from "@/components/layout/coming-soon-trigger";
import { ComingSoonBadge } from "@/components/ui/coming-soon";
import { cn } from "@/lib/utils/cn";

// A post action whose feature is not built yet (DC-21): the designed pill shape in muted colours
// with a "Soon" pill. Save waits for P1-25, Start as my project for P2 (non-tutorial posts).

const SHAPES = {
  /** Where the design has a primary (coral) button. */
  filled: "bg-muted text-muted-foreground",
  /** Where the design has an outline button. */
  outline: "border-control border-border-strong text-muted-foreground",
} as const;

export function ComingSoonAction({
  label,
  shape,
  icon,
  badge = "pill",
  className,
}: {
  label: string;
  shape: keyof typeof SHAPES;
  icon?: React.ReactNode;
  /** `dot` where a "Soon" pill doesn't fit next to the label (mobile action bar). */
  badge?: "pill" | "dot";
  className?: string;
}) {
  return (
    <ComingSoonTrigger
      label={label}
      hasVisibleLabel
      className={cn(
        "relative inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full px-4 text-control font-bold whitespace-nowrap",
        SHAPES[shape],
        className,
      )}
    >
      {icon}
      {label}
      {badge === "pill" ? (
        <ComingSoonBadge size="sm" decorative />
      ) : (
        <ComingSoonBadge size="dot" decorative className="absolute top-1 right-3" />
      )}
    </ComingSoonTrigger>
  );
}
