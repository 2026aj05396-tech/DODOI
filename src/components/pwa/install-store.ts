"use client";

import { isIosSafari, shouldOfferInstall, type InstallEngagement } from "@/lib/utils/install-offer";

// Install guidance state (USER_FLOWS F-12). Chromium fires `beforeinstallprompt` when the app can
// be installed; it is kept here (and the browser's own mini-infobar suppressed) until the banner
// offers it. Visits, the first save and dismissals are remembered on this device only.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** What the banner offers: Chromium's install prompt, the iOS steps, or nothing. */
export type InstallOffer = "prompt" | "ios" | "none";

const VISITS_KEY = "dodoi:install:visits";
const SAVED_KEY = "dodoi:install:saved";
const DISMISSED_KEY = "dodoi:install:dismissed-at";
const SESSION_KEY = "dodoi:install:visit-counted";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isInstalled = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    isInstalled = true;
    emit();
  });
}

// Storage can be unavailable (private mode, blocked site data): then the banner just never shows.
function read(key: string, storage: () => Storage = () => localStorage): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string, storage: () => Storage = () => localStorage): void {
  try {
    storage().setItem(key, value);
  } catch {
    // Not remembered; nothing else to do.
  }
}

function engagement(): InstallEngagement {
  const dismissedAt = Number(read(DISMISSED_KEY));
  return {
    visits: Number(read(VISITS_KEY)) || 0,
    hasSaved: read(SAVED_KEY) === "1",
    dismissedAt: dismissedAt > 0 ? dismissedAt : null,
  };
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOffer(): InstallOffer {
  if (isInstalled || isStandalone()) return "none";
  const offer: InstallOffer = deferredPrompt
    ? "prompt"
    : isIosSafari(navigator.userAgent, navigator.maxTouchPoints)
      ? "ios"
      : "none";
  if (offer === "none" || !shouldOfferInstall(engagement(), Date.now())) return "none";
  return offer;
}

export function getServerOffer(): InstallOffer {
  return "none";
}

/** Counts this browser session as a visit (once per session). */
export function recordVisit(): void {
  if (read(SESSION_KEY, () => sessionStorage)) return;
  write(SESSION_KEY, "1", () => sessionStorage);
  write(VISITS_KEY, String(engagement().visits + 1));
  emit();
}

/** The first save counts as enough engagement to offer installing. */
export function recordSave(): void {
  if (read(SAVED_KEY) === "1") return;
  write(SAVED_KEY, "1");
  emit();
}

export function dismissInstall(): void {
  write(DISMISSED_KEY, String(Date.now()));
  emit();
}

/** Opens Chromium's own install dialog. Accepting fires `appinstalled`, which hides the banner. */
export async function promptInstall(): Promise<void> {
  const event = deferredPrompt;
  if (!event) return;
  deferredPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "dismissed") dismissInstall();
  else emit();
}
