import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";

// Top bar of the Create flow (F-17), as on Instagram: close or back on the left, the screen's name
// in the middle, the next action on the right. Phones also get that action in a bottom bar.

export function CreateHeader({
  title,
  onBack,
  backLabel,
  status,
  action,
}: {
  title: string;
  onBack: () => void;
  /** "Close" on the first screen, "Back" after it. */
  backLabel: "Close" | "Back";
  /** e.g. "Saved as draft · just now". */
  status?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = backLabel === "Close" ? X : ArrowLeft;
  return (
    <header className="sticky top-0 z-30 border-b border-border-faint bg-background/95 backdrop-blur">
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2 px-2 md:h-16 md:px-6">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <Icon aria-hidden className="size-5.5" />
        </button>
        <div className="flex min-w-0 flex-col items-center text-center">
          <h1 className="truncate text-section text-foreground">{title}</h1>
          {status ? (
            <p className="truncate text-meta text-muted-foreground" aria-live="polite">
              {status}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-12 justify-end">{action}</div>
      </div>
    </header>
  );
}
