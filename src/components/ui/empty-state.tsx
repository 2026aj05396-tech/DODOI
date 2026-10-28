import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type EmptyStateProps = {
  /** Decorative icon or illustration; hidden from screen readers. */
  icon?: ReactNode;
  title: string;
  /** Use "h1" when the empty state is the whole page (e.g. not found); defaults to a paragraph. */
  titleAs?: "h1" | "h2" | "h3" | "p";
  description?: string;
  /** One primary action, e.g. a Button linking to Explore. */
  action?: ReactNode;
  className?: string;
};

/** "Nothing here yet" state: one message and at most one action (UI_UX_GUIDELINES §4). */
export function EmptyState({
  icon,
  title,
  titleAs: Title = "p",
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      {icon ? (
        <div aria-hidden className="text-muted-foreground [&>svg]:size-8">
          {icon}
        </div>
      ) : null}
      <Title className="text-section text-foreground">{title}</Title>
      {description ? (
        <p className="max-w-sm text-body text-foreground-secondary">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
