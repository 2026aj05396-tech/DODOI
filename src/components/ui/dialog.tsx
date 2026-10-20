"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

// Modal surfaces. `dialog` is centred; `sheet` slides up from the bottom on mobile (collection
// picker, filters) and becomes a centred panel from md up. Radix handles focus trapping and
// returns focus to the trigger on close (UI_UX_GUIDELINES §7).

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const contentVariants = cva(
  "fixed z-50 flex flex-col gap-4 bg-popover p-6 text-popover-foreground shadow-frame",
  {
    variants: {
      layout: {
        dialog:
          "top-1/2 left-1/2 max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg",
        sheet:
          "inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-lg pb-[max(1.5rem,env(safe-area-inset-bottom))] md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg",
      },
    },
    defaultVariants: { layout: "dialog" },
  },
);

export type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
  VariantProps<typeof contentVariants> & {
    /** Accessible label for the close button. */
    closeLabel?: string;
  };

export function DialogContent({
  className,
  layout,
  closeLabel = "Close",
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-inverse/40" />
      <DialogPrimitive.Content className={cn(contentVariants({ layout }), className)} {...props}>
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <X aria-hidden className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("pr-10 text-section text-foreground", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-body text-foreground-secondary", className)}
      {...props}
    />
  );
}
