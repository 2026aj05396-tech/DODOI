import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

// Chips from the design (UI_UX_GUIDELINES §4). Three components instead of one configurable chip,
// because a static label, a toggle and an action behave differently for keyboard and screen readers.

const tagVariants = cva("inline-flex items-center rounded-full px-3 py-1 text-meta", {
  variants: {
    variant: {
      /** Neutral facts such as level or duration ("Beginner", "45 min"). */
      meta: "bg-muted text-foreground",
      /** A skill label ("Pipe cleaner art"). */
      skill: "bg-lavender font-bold text-plum",
    },
  },
  defaultVariants: { variant: "meta" },
});

export type TagProps = ComponentPropsWithoutRef<"span"> & VariantProps<typeof tagVariants>;

/** Non-interactive label chip. */
export function Tag({ className, variant, ...props }: TagProps) {
  return <span className={cn(tagVariants({ variant }), className)} {...props} />;
}

const toggleChipVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition duration-150 active:scale-96",
  {
    variants: {
      variant: {
        /** Feed filter ("For you", "Crochet", "New to you"). */
        filter:
          "h-9 border border-border bg-field px-3.5 text-control-sm aria-pressed:border-transparent aria-pressed:bg-inverse aria-pressed:font-bold aria-pressed:text-inverse-foreground md:h-9.5 md:px-4 md:text-control",
        /** Onboarding interest picker. */
        interest:
          "h-10 border-control border-input bg-background px-4 text-control hover:border-link aria-pressed:border-selected-border aria-pressed:bg-primary aria-pressed:font-bold aria-pressed:hover:border-selected-border",
      },
    },
    defaultVariants: { variant: "filter" },
  },
);

export type ToggleChipProps = Omit<ComponentPropsWithoutRef<"button">, "onClick"> &
  VariantProps<typeof toggleChipVariants> & {
    pressed: boolean;
    onPressedChange: (nextPressed: boolean) => void;
  };

/** Chip that is either on or off; announced as a toggle button (`aria-pressed`). */
export function ToggleChip({
  className,
  variant,
  pressed,
  onPressedChange,
  children,
  ...props
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(toggleChipVariants({ variant }), className)}
      {...props}
    >
      {variant === "interest" && pressed ? (
        <Check aria-hidden className="size-3.5 animate-dd-pop" strokeWidth={2.5} />
      ) : null}
      {children}
    </button>
  );
}

const actionChipVariants = cva(
  "inline-flex h-8.5 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-control-sm whitespace-nowrap transition-transform duration-150 active:scale-96",
  {
    variants: {
      variant: {
        /** Quick suggestion ("Make a materials checklist", "Leftover yarn"). */
        suggestion: "border border-border-strong bg-background",
        /** "+ Add your own". */
        add: "h-10 border-control border-dashed border-border-faint bg-background px-4 text-control text-foreground-secondary",
      },
    },
    defaultVariants: { variant: "suggestion" },
  },
);

export type ActionChipProps = ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof actionChipVariants>;

/** Chip that performs an action when pressed. */
export function ActionChip({ className, variant, type, ...props }: ActionChipProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(actionChipVariants({ variant }), className)}
      {...props}
    />
  );
}
