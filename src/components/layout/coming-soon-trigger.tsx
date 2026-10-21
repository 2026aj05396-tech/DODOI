"use client";

import { Tooltip } from "radix-ui";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type ComingSoonTriggerProps = {
  label: string;
  /** True when `children` already show `label` as text; otherwise the label is added for screen readers. */
  hasVisibleLabel?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Wraps the visual for an unbuilt feature (DC-21). It is announced as "{label}, coming soon",
 * marked aria-disabled, never navigates or calls an API, and shows a "Coming soon" tooltip on
 * hover, keyboard focus or tap. The accessible name comes from the content (not aria-label) so it
 * always contains the visible text, which voice-control users speak. Visual "Soon" badges inside
 * must be `decorative`.
 */
export function ComingSoonTrigger({
  label,
  hasVisibleLabel = false,
  className,
  children,
}: ComingSoonTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-disabled="true"
            onClick={(event) => {
              event.preventDefault();
              setIsOpen(true);
            }}
            className={cn("cursor-default", className)}
          >
            {children}
            <span className="sr-only">
              {hasVisibleLabel ? ", coming soon" : `${label}, coming soon`}
            </span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 rounded-md bg-inverse px-2.5 py-1.5 text-control-sm text-inverse-foreground shadow-float"
          >
            Coming soon
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
