// Open Graph and Twitter defaults (P1-30). Next.js replaces a parent's `openGraph` and `twitter`
// objects instead of merging them, so every page that sets its own spreads these in.

export const OPEN_GRAPH_DEFAULTS = { siteName: "dodoi", locale: "en_IN", type: "website" } as const;

export const TWITTER_DEFAULTS = { card: "summary_large_image" } as const;
