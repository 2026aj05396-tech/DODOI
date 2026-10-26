import { Label as LabelPrimitive } from "radix-ui";
import type { ComponentProps, ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

/** Includes `ref` (a plain prop in React 19), e.g. to pre-fill or focus the field. */
export type InputProps = ComponentProps<"input">;

/** Text input. Uses 16px text so iOS does not zoom on focus; `aria-invalid` shows the error border. */
export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type ?? "text"}
      className={cn(
        "h-11.5 w-full rounded-md border-control border-input bg-background px-3.5 text-control-lg text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export type LabelProps = ComponentPropsWithoutRef<typeof LabelPrimitive.Root>;

/** Visible form label (every input has one — UI_UX_GUIDELINES §7). */
export function Label({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn("text-control-sm font-bold text-foreground", className)}
      {...props}
    />
  );
}

export type TextareaProps = ComponentProps<"textarea">;

/** Multi-line text, styled like Input. */
export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border-control border-input bg-background px-3.5 py-2.5 text-control-lg text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export type SelectProps = ComponentProps<"select">;

/** Native select (keyboard and screen-reader friendly everywhere), styled like Input. */
export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-11.5 w-full rounded-md border-control border-input bg-background px-3 text-control-lg text-foreground disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
