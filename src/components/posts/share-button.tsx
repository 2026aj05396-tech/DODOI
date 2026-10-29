"use client";

import { Link2, Mail, MessageCircle, Share2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useSyncExternalStore } from "react";

import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

// "Share link" (POST-09; PO decision 2026-10-29): sends a link to the post — it never publishes
// anything ("Post" does that in Create). Where the device has a share sheet (most phones) it opens
// it; elsewhere a small menu offers Copy link, WhatsApp and Email.

const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

async function copyLink(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(absoluteUrl(path));
    showToast({ message: "Link copied" });
  } catch {
    showToast({ message: "We couldn't copy the link. Copy it from the address bar instead." });
  }
}

/** The system share sheet where there is one, otherwise the link is copied. */
export async function sharePost(title: string, path: string): Promise<void> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url: absoluteUrl(path) });
      return;
    } catch (error) {
      // Closing the share sheet is not an error; anything else falls back to copying.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  await copyLink(path);
}

const noSubscription = () => () => {};

/** Whether the browser has a share sheet; false while rendering on the server. */
function useCanShareNatively(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => typeof navigator.share === "function",
    () => false,
  );
}

const TRIGGER: Record<"overlay" | "outline" | "wide", string> = {
  // The round button over the mobile media (`1e`).
  overlay:
    "flex size-11 shrink-0 items-center justify-center rounded-full bg-background text-foreground shadow-float",
  // Beside the other post actions from 768px.
  outline:
    "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border-control border-foreground px-4 text-control font-bold text-foreground transition-transform active:scale-96",
  // A full-width action ("Posted!" card).
  wide: "inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border-control border-foreground px-6 text-control-lg font-bold text-foreground transition-transform active:scale-96",
};

/**
 * Share a post's link. `overlay` is icon-only (labelled for screen readers); `outline` and `wide`
 * show "Share link".
 */
export function ShareButton({
  title,
  path,
  variant,
  className,
}: {
  title: string;
  /** Path of the post, e.g. "/p/abc"; shared as an absolute link. */
  path: string;
  variant: "overlay" | "outline" | "wide";
  className?: string;
}) {
  const canShareNatively = useCanShareNatively();
  const content = (
    <>
      <Share2 aria-hidden className="size-5" strokeWidth={1.9} />
      {variant === "overlay" ? null : "Share link"}
    </>
  );
  const triggerProps = {
    "aria-label": variant === "overlay" ? "Share link" : undefined,
    className: cn(TRIGGER[variant], className),
  };

  if (canShareNatively) {
    return (
      <button type="button" {...triggerProps} onClick={() => void sharePost(title, path)}>
        {content}
      </button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger {...triggerProps}>{content}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-52 rounded-md border border-border bg-background p-1 shadow-float"
        >
          <DropdownMenu.Item className={MENU_ITEM} onSelect={() => void copyLink(path)}>
            <Link2 aria-hidden className="size-4.5" />
            Copy link
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={MENU_ITEM}
            onSelect={() =>
              window.open(
                `https://wa.me/?text=${encodeURIComponent(`${title} ${absoluteUrl(path)}`)}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <MessageCircle aria-hidden className="size-4.5" />
            WhatsApp
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={MENU_ITEM}
            onSelect={() => {
              window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(absoluteUrl(path))}`;
            }}
          >
            <Mail aria-hidden className="size-4.5" />
            Email
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
