"use client";

import { ToggleChip } from "@/components/ui/chip";
import type { FeedFilterChip } from "@/lib/types/feed";

// Feed filter chips (FEED-13, `1c`/`2b`/`3c`): For you, up to 5 interests, New to you. One is
// always on; choosing another starts a new feed session. Scrolls sideways on narrow screens.

export function FilterBar({
  chips,
  active,
  onChange,
}: {
  chips: FeedFilterChip[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter the feed"
      className="-mx-5 flex scrollbar-none gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0"
    >
      {chips.map((chip) => (
        <ToggleChip
          key={chip.key}
          pressed={chip.key === active}
          onPressedChange={() => {
            if (chip.key !== active) onChange(chip.key);
          }}
        >
          {chip.label}
        </ToggleChip>
      ))}
    </div>
  );
}
