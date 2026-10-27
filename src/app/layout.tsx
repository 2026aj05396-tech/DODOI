import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

import "@/styles/globals.css";

import { CollectionPickerHost } from "@/components/collections/collection-picker";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/toast";
import { OPEN_GRAPH_DEFAULTS, TWITTER_DEFAULTS } from "@/lib/constants/share-metadata";
import { serverEnv } from "@/server/lib/env";

// DM Sans is the only typeface (UI_UX_GUIDELINES §2.4). Self-hosted at build time by next/font.
const dmSans = DM_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
  display: "swap",
});

// Defaults for every page (P1-30). `metadataBase` turns relative Open Graph URLs into absolute
// ones on the environment's own domain; pages that can be shared (landing, posts) add their own.
export const metadata: Metadata = {
  metadataBase: new URL(serverEnv.AUTH_URL),
  title: "dodoi",
  applicationName: "dodoi",
  description: "For the things you love making, and all the things you haven't tried yet.",
  openGraph: OPEN_GRAPH_DEFAULTS,
  twitter: TWITTER_DEFAULTS,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        <QueryProvider>
          {children}
          <CollectionPickerHost />
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
