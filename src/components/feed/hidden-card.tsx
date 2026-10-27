"use client";

import { Button } from "@/components/ui/button";

/** What a card collapses to after "Not interested" (USER_FLOWS F-06): "Hidden." and Undo. */
export function HiddenCard({ onUndo }: { onUndo: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-card border border-dashed border-border-faint px-4 py-3"
    >
      <span className="text-body text-foreground-secondary">Hidden.</span>
      <Button variant="text" onClick={onUndo}>
        Undo
      </Button>
    </div>
  );
}
