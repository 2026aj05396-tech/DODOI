import { MEDIA_CACHE, PAGES_CACHE } from "@/lib/constants/offline";

/**
 * Deletes the pages and images the service worker kept for offline use, so the next person on
 * this device can't open them (sign-out, account deletion; offline matrix). Never throws: signing
 * out must not fail because storage is unavailable.
 */
export async function clearOfflineData(): Promise<void> {
  if (typeof caches === "undefined") return;
  await Promise.all([caches.delete(PAGES_CACHE), caches.delete(MEDIA_CACHE)]).catch(
    () => undefined,
  );
}
