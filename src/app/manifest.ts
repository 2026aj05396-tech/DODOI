import type { MetadataRoute } from "next";

// Web app manifest (P1-27, SYSTEM_ARCHITECTURE §9). The icons are design `1a` "Coral", written by
// `pnpm icons` (scripts/generate-icons.ts). `/` sends signed-in people to their feed and everyone
// else to the welcome page. The colours are the paper token (src/styles/tokens.css), so the splash
// screen and title bar match the app's background.

const PAPER = "#fff8f0";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "dodoi",
    short_name: "dodoi",
    description: "For the things you love making, and all the things you haven't tried yet.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PAPER,
    theme_color: PAPER,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
