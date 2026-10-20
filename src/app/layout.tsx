import type { Metadata } from "next";

import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "dodoi",
  description: "For the things you love making, and all the things you haven't tried yet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
