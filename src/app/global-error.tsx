"use client";

import "@/styles/globals.css";

import { ErrorState } from "@/components/ui/error-state";

// Last-resort boundary for errors in the root layout. It renders its own document, so it imports
// the global styles itself (Next.js does not apply them here).
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong · dodoi</title>
        <main className="flex min-h-dvh items-center justify-center">
          <ErrorState message="Something went wrong. Please try again." onRetry={retry} />
        </main>
      </body>
    </html>
  );
}
