import { cn } from "@/lib/utils/cn";

export type WordmarkProps = {
  /** `full` = "dodoi" with the butter dot; `monogram` = "d." for the 76px icon rail (`2c`, `3c`). */
  variant?: "full" | "monogram";
  className?: string;
};

/** The dodoi logo as text. Size it with a text utility on `className` (design: 24–28px). */
export function Wordmark({ variant = "full", className }: WordmarkProps) {
  if (variant === "monogram") {
    return (
      <span role="img" aria-label="dodoi" className={cn("text-wordmark text-link", className)}>
        d<span className="text-butter-strong">.</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-wordmark text-link", className)}>
      dodoi
      <span aria-hidden className="mt-2.5 size-2 rounded-full bg-butter-strong" />
    </span>
  );
}
