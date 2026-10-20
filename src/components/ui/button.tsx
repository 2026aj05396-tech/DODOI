import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

// Pill buttons from the design (UI_UX_GUIDELINES §4). Press scales to .96; disabled buttons use
// the muted field style shown on the onboarding "Pick n more to continue" button.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition duration-150 ease-out select-none active:scale-96 disabled:pointer-events-none disabled:bg-border disabled:text-foreground-secondary disabled:border-transparent [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline: "border-control border-foreground bg-transparent text-foreground",
        inverse: "bg-inverse text-inverse-foreground",
        text: "rounded-sm bg-transparent px-0 text-link hover:underline",
      },
      size: {
        sm: "h-9.5 px-4 text-control",
        md: "h-11 px-5 text-control",
        lg: "h-13 px-6 text-control-lg",
        xl: "h-14 px-7 text-control-xl",
      },
    },
    compoundVariants: [{ variant: "text", class: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a Next.js Link) with button styles instead of a <button>. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return <Slot.Root className={classes} {...props} />;
  }
  return <button type={type ?? "button"} className={classes} {...props} />;
}
