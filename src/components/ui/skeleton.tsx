import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

/** Loading placeholder. Size it like the final content so nothing shifts when it loads. */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div aria-hidden className={cn("animate-pulse rounded-card bg-muted", className)} {...props} />
  );
}
