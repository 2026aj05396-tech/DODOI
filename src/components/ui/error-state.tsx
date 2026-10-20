"use client";

import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/** Something failed to load. Plain-language message plus "Try again" (UI_UX_GUIDELINES §6). */
export function ErrorState({
  message = "Something went wrong loading this.",
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}
    >
      <p className="max-w-sm text-body text-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden className="size-4" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
