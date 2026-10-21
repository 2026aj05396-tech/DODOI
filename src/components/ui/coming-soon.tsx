import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

// Features that are not built yet stay visible but inactive (PRODUCT_REQUIREMENTS NAV-01…05).

export type ComingSoonBadgeProps = {
  /**
   * `md` = "Coming soon" pill for cards (`3b`); `sm` = "Soon" pill for nav items and buttons;
   * `dot` = butter dot for tight spots such as icon-only rail items (DC-21).
   */
  size?: "sm" | "md" | "dot";
  /** Hide from assistive tech when the surrounding control already says "coming soon". */
  decorative?: boolean;
  className?: string;
};

export function ComingSoonBadge({
  size = "md",
  decorative = false,
  className,
}: ComingSoonBadgeProps) {
  if (size === "dot") {
    return (
      <span
        aria-hidden={decorative || undefined}
        className={cn(
          "size-2.5 shrink-0 rounded-full bg-butter-strong ring-2 ring-background",
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-butter text-foreground uppercase",
        size === "md" ? "px-2.5 py-1 text-badge" : "px-1.5 py-0.5 text-badge-sm",
        className,
      )}
    >
      {size === "md" ? "Coming soon" : "Soon"}
    </span>
  );
}

export type ComingSoonCardProps = {
  title: string;
  /** One line on what the feature will do. */
  description: string;
  icon?: ReactNode;
  className?: string;
};

/** Dashed, muted, non-interactive card for an upcoming feature (design `3b`, right rail `2b`). */
export function ComingSoonCard({ title, description, icon, className }: ComingSoonCardProps) {
  return (
    <div
      aria-disabled="true"
      className={cn(
        "flex flex-col gap-1 rounded-card border-control border-dashed border-border-faint p-3.5",
        className,
      )}
    >
      {/* The badge wraps under the title when the card is narrow (e.g. the 300px right rail). */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {icon ? (
          <span aria-hidden className="text-foreground-secondary [&_svg]:size-5">
            {icon}
          </span>
        ) : null}
        <span className="min-w-40 flex-1 text-control font-bold text-foreground-secondary">
          {title}
        </span>
        <ComingSoonBadge />
      </div>
      <span className="text-meta text-foreground-secondary">{description}</span>
    </div>
  );
}
