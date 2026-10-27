// Offline matrix (SYSTEM_ARCHITECTURE §9, approved by the PO 2026-10-27), shared by the service
// worker (src/app/sw.ts) and the app, which clears both caches on sign-out.

/** Pages kept after a visit, network first (last copy shown while offline). */
export const PAGES_CACHE = "dodoi-pages";
/** Cloudinary images already viewed, cache first. */
export const MEDIA_CACHE = "dodoi-media";

/** Shown for any page that isn't in the cache while offline. */
export const OFFLINE_PATH = "/offline";

/**
 * Pages for reading that are kept for offline use: feed, posts, saved and collections, Explore,
 * skill and theme pages. Search, settings, sign-in, onboarding and admin always need the network.
 */
const READABLE_OFFLINE = [
  /^\/feed$/,
  /^\/p\/[^/]+$/,
  /^\/saved(\/[^/]+)?$/,
  /^\/explore(\/skills)?$/,
  /^\/s\/[^/]+$/,
  /^\/t\/[^/]+$/,
];

export function isReadableOffline(pathname: string): boolean {
  return READABLE_OFFLINE.some((pattern) => pattern.test(pathname));
}
