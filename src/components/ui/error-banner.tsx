import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

export type ErrorBannerProps = ComponentPropsWithoutRef<"div">;

/** Inline error message for a failed action, e.g. "Couldn't upload your photo..." (design `3b`). */
export function ErrorBanner({ className, ...props }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md bg-destructive-surface px-3.5 py-2.5 text-control-sm text-foreground",
        className,
      )}
      {...props}
    />
  );
}
