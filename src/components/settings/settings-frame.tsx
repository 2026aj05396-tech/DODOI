import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// Frame for settings screens (P1-14; not designed, built from the system): a back link, the
// title and a single centred column at every width.

export function SettingsFrame({
  title,
  description,
  backHref = "/settings",
  backLabel = "Settings",
  children,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 pt-4 pb-10 md:px-7 md:pt-8">
      <div className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 self-start rounded-sm text-control font-bold text-foreground-secondary hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {backLabel}
        </Link>
        <h1 className="text-greeting text-foreground md:text-greeting-web">{title}</h1>
        {description ? <p className="text-body text-foreground-secondary">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
