/// <reference lib="webworker" />
// Service worker (P1-27), following the approved offline matrix (SYSTEM_ARCHITECTURE §9).
// Bundled by Serwist (src/app/serwist/[path]/route.ts) and served at /serwist/sw.js.
//
// - App shell, JS/CSS, fonts, icons and the offline page: precached at install.
// - Pages for reading (feed, posts, saved, Explore, skill and theme pages): network first, the
//   last copy while offline (the offline banner says what is shown is from the last visit).
// - Cloudinary images already viewed: cache first, at most 200 for 7 days.
// - Everything else (API, video, search, sign-in, settings, admin): network only; a page that
//   can't load offline shows the offline page. Nothing is queued to send later.
import type { PrecacheEntry, RouteMatchCallbackOptions, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from "serwist";

import { MEDIA_ORIGIN } from "@/lib/constants/media";
import { MEDIA_CACHE, OFFLINE_PATH, PAGES_CACHE, isReadableOffline } from "@/lib/constants/offline";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

/**
 * A full HTML page for reading: a page load, or the copy SerwistProvider asks for after a
 * client-side navigation. Client-side navigations and prefetches themselves fetch RSC data.
 */
function isReadablePage({ request, url }: RouteMatchCallbackOptions): boolean {
  return (
    url.origin === self.location.origin &&
    isReadableOffline(url.pathname) &&
    !request.headers.has("RSC") &&
    !url.searchParams.has("_rsc")
  );
}

function isPageLoad({ request, url }: RouteMatchCallbackOptions): boolean {
  return url.origin === self.location.origin && request.mode === "navigate";
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: isReadablePage,
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE,
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          // A redirect (e.g. signed out → sign-in) must not be kept as the page it came from.
          { cacheWillUpdate: async ({ response }) => (response.redirected ? null : response) },
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: SEVEN_DAYS_IN_SECONDS }),
        ],
      }),
    },
    {
      matcher: ({ request, url }) => url.origin === MEDIA_ORIGIN && request.destination === "image",
      handler: new CacheFirst({
        cacheName: MEDIA_CACHE,
        // Cloudinary allows CORS, so the cached copies aren't opaque (opaque ones count as several
        // MB each against the storage quota).
        fetchOptions: { mode: "cors", credentials: "omit" },
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: SEVEN_DAYS_IN_SECONDS,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // Every other page: a route of its own so a failed load gets the offline page below.
    { matcher: isPageLoad, handler: new NetworkOnly() },
  ],
  fallbacks: {
    entries: [{ url: OFFLINE_PATH, matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
