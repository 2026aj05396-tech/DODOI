"use client";

import { Share, SquarePlus, X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  dismissInstall,
  getOffer,
  getServerOffer,
  promptInstall,
  recordVisit,
  subscribe,
} from "./install-store";

// Install guidance (P1-27, USER_FLOWS F-12, PWA-04). Not designed: built from the design system
// like the verify-email banner (DC-11), in lavender so the two read as different notices. Shown in
// the signed-in app after the first save or on the second visit, not again for 30 days once
// dismissed, never when installed. Chromium gets its own install dialog; Safari on iPhone and
// iPad gets the Share → Add to Home Screen steps.

export function InstallBanner() {
  const offer = useSyncExternalStore(subscribe, getOffer, getServerOffer);

  useEffect(() => {
    recordVisit();
  }, []);

  if (offer === "none") return null;

  return (
    <aside
      aria-label="Install dodoi"
      className="relative mx-5 mt-4 flex flex-col gap-3 rounded-card bg-lavender p-4 pr-14 md:mx-7 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 192px icon from public/. */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="shrink-0" />
        <p className="text-body text-foreground">
          <strong className="font-bold">Put dodoi on your home screen.</strong> It opens like an
          app, and your feed and saved posts work offline.
        </p>
      </div>
      {offer === "prompt" ? (
        <Button size="md" variant="inverse" onClick={() => void promptInstall()}>
          Install app
        </Button>
      ) : (
        <IosSteps />
      )}
      <button
        type="button"
        aria-label="Not now"
        onClick={dismissInstall}
        className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full text-foreground hover:bg-background/50"
      >
        <X aria-hidden className="size-5" />
      </button>
    </aside>
  );
}

/** Safari has no install prompt: the steps, with the icons Safari shows. */
function IosSteps() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="md" variant="inverse">
          How to install
        </Button>
      </DialogTrigger>
      <DialogContent layout="sheet">
        <DialogTitle>Add dodoi to your home screen</DialogTitle>
        <DialogDescription>Three taps in Safari:</DialogDescription>
        <ol className="flex flex-col gap-3 text-body text-foreground">
          <li className="flex items-center gap-3">
            <Share aria-hidden className="size-5 shrink-0" />
            <span>
              1. Tap <strong className="font-bold">Share</strong> in Safari&apos;s toolbar.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <SquarePlus aria-hidden className="size-5 shrink-0" />
            <span>
              2. Choose <strong className="font-bold">Add to Home Screen</strong>.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span aria-hidden className="w-5 shrink-0 text-center font-bold">
              ✓
            </span>
            <span>
              3. Tap <strong className="font-bold">Add</strong>.
            </span>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
