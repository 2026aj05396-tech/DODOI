import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

import "@/styles/globals.css";

import { Toaster } from "@/components/ui/toast";

// DM Sans is the only typeface (UI_UX_GUIDELINES §2.4). Self-hosted at build time by next/font.
const dmSans = DM_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "dodoi",
  description: "For the things you love making, and all the things you haven't tried yet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
