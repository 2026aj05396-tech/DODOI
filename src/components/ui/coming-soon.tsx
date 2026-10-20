import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

// Features that are not built yet stay visible but inactive (PRODUCT_REQUIREMENTS NAV-01…05).

export type ComingSoonBadgeProps = {
  /** `sm` = "Soon" for nav items and small buttons (DC-21); `md` = "Coming soon" for cards (`3b`). */
  size?: "sm" | "md";
  className?: string;
};

export function ComingSoonBadge({ size = "md", className }: ComingSoonBadgeProps) {
  return (
    <span
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

/** Dashed, muted, non-interactive card for an upcoming feature (design `3b`). */
export function ComingSoonCard({ title, description, icon, className }: ComingSoonCardProps) {
  return (
    <div
      aria-disabled="true"
      className={cn(
        "flex items-center justify-between gap-2.5 rounded-card border-control border-dashed border-border-faint p-3.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span aria-hidden className="text-foreground-secondary [&_svg]:size-5">
            {icon}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-control font-bold text-foreground-secondary">{title}</span>
          <span className="text-meta text-foreground-secondary">{description}</span>
        </div>
      </div>
      <ComingSoonBadge />
    </div>
  );
}
