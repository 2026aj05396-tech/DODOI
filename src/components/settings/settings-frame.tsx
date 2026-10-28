import type { ReactNode } from "react";

import { BackButton } from "@/components/ui/back-button";
import { cn } from "@/lib/utils/cn";

// Frame for settings screens (P1-14; not designed, built from the system): a back icon, the
// title and a single centred column at every width.

export function SettingsFrame({
  title,
  description,
  backHref = "/settings",
  className,
  children,
}: {
  title: string;
  description?: string;
  /** Where Back goes when there is no page in history to return to. */
  backHref?: string;
  /** E.g. a wider column for a grid (`max-w-6xl`). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-2xl flex-col gap-6 px-5 pt-4 pb-10 md:px-7 md:pt-8",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <BackButton fallbackHref={backHref} />
        <h1 className="text-greeting text-foreground md:text-greeting-web">{title}</h1>
        {description ? <p className="text-body text-foreground-secondary">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
