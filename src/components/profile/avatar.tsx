import { PatternTile } from "@/components/ui/pattern-tile";
import { cn } from "@/lib/utils/cn";

/**
 * A profile photo, or the craft-pattern placeholder until one is uploaded (PRF-01, `1i`).
 * Decorative: the name next to it says whose it is.
 */
export function Avatar({ url, className }: { url: string | null; className?: string }) {
  if (!url) return <PatternTile accent="blush" className={cn("rounded-full", className)} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image.
    <img src={url} alt="" className={cn("rounded-full bg-muted object-cover", className)} />
  );
}
