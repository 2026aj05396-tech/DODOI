import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

export type FieldErrorProps = ComponentPropsWithoutRef<"p"> & {
  /** Must match the input's `aria-describedby` so screen readers read the message with the field. */
  id: string;
};

/** Inline validation message under a field (design `3b`). Renders nothing without children. */
export function FieldError({ className, children, ...props }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-meta text-destructive", className)} {...props}>
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive text-tab font-bold text-inverse-foreground"
      >
        !
      </span>
      {children}
    </p>
  );
}
