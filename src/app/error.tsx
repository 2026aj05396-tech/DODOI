"use client";

import { ErrorState } from "@/components/ui/error-state";

// Shown when a page fails to render. The error is logged on the server; users get a plain message
// and a retry that re-fetches the page (UI_UX_GUIDELINES §6).
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <ErrorState message="Something went wrong loading this page." onRetry={retry} />
    </main>
  );
}
