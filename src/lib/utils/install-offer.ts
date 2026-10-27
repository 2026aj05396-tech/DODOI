// When to offer installing the app (USER_FLOWS F-12, APPROVED by the PO 2026-10-27): after the
// first save or on the second visit, whichever comes first; once dismissed, not again for 30 days;
// never when it is already installed.

const DAY_MS = 24 * 60 * 60 * 1000;
export const INSTALL_DISMISS_DAYS = 30;

export type InstallEngagement = {
  /** Browser sessions in which the signed-in app was opened on this device. */
  visits: number;
  hasSaved: boolean;
  /** When the banner was last dismissed (epoch ms), if ever. */
  dismissedAt: number | null;
};

export function shouldOfferInstall(engagement: InstallEngagement, now: number): boolean {
  if (
    engagement.dismissedAt !== null &&
    now - engagement.dismissedAt < INSTALL_DISMISS_DAYS * DAY_MS
  ) {
    return false;
  }
  return engagement.hasSaved || engagement.visits >= 2;
}

/**
 * Safari on iPhone or iPad, which installs only through Share → Add to Home Screen (it has no
 * install prompt). iPadOS reports itself as a Mac, so a touch screen gives it away. Other iOS
 * browsers are left out: their menus differ.
 */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const isIos =
    /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return isIos && /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}
