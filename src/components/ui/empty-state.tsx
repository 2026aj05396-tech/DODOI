import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type EmptyStateProps = {
  /** Decorative icon or illustration; hidden from screen readers. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** One primary action, e.g. a Button linking to Explore. */
  action?: ReactNode;
  className?: string;
};

/** "Nothing here yet" state: one message and at most one action (UI_UX_GUIDELINES §4). */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      {icon ? (
        <div aria-hidden className="text-muted-foreground [&_svg]:size-8">
          {icon}
        </div>
      ) : null}
      <p className="text-section text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-body text-foreground-secondary">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
