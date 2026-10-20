"use client";

import { Search } from "lucide-react";
import { useId, type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

export type SearchFieldProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  /** Accessible name. The design shows only a placeholder, so the label is visually hidden. */
  label: string;
  /** `field` = filled (mobile screens), `outline` = paper with border (web screens). */
  appearance?: "field" | "outline";
};

export function SearchField({
  label,
  appearance = "field",
  className,
  id,
  ...props
}: SearchFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div
      className={cn(
        // The input hides its own outline; the pill shows the keyboard focus ring instead.
        "flex h-12 items-center gap-2.5 rounded-full border px-4 text-muted-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring md:h-11.5",
        appearance === "field" ? "border-border bg-field" : "border-border bg-background",
        className,
      )}
    >
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search aria-hidden className="size-4.5" strokeWidth={1.8} />
      <input
        id={inputId}
        type="search"
        className="h-full min-w-0 flex-1 bg-transparent text-control-lg text-foreground outline-none placeholder:text-muted-foreground"
        {...props}
      />
    </div>
  );
}
