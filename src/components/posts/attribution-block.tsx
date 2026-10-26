import { ExternalLink } from "lucide-react";

import type { Attribution } from "@/lib/types/posts";
import { cn } from "@/lib/utils/cn";

/** "commons.wikimedia.org" from a source link, for the link text. */
function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Where a seeded post comes from (POST-13, DC-10, `1e`): below the steps, sand box with overline
 * "Source", the attribution text, the original author, a link to the source and the licence.
 */
export function AttributionBlock({
  attribution,
  className,
}: {
  attribution: Attribution;
  className?: string;
}) {
  const showAuthor =
    attribution.originalAuthor && !attribution.attributionText.includes(attribution.originalAuthor);
  return (
    <section aria-labelledby="post-source" className={cn("rounded-card bg-field p-4", className)}>
      <h2 id="post-source" className="text-overline text-foreground-secondary uppercase">
        Source
      </h2>
      <p className="mt-2 text-body text-foreground">{attribution.attributionText}</p>
      {showAuthor ? (
        <p className="mt-1 text-body text-foreground">By {attribution.originalAuthor}</p>
      ) : null}
      {attribution.originalUrl ? (
        <a
          href={attribution.originalUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-1 inline-flex items-center gap-1 rounded-sm text-body font-bold text-foreground underline underline-offset-2"
        >
          {siteName(attribution.originalUrl)}
          <ExternalLink aria-hidden className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null}
      <p className="mt-2 text-meta text-foreground-secondary">
        License: {attribution.license} · Added by dodoi editors
      </p>
    </section>
  );
}
