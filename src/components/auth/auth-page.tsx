import { Suspense, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Wordmark } from "@/components/ui/wordmark";

type AuthPageProps = {
  title: string;
  /** Rendered at request time (reads the session or URL), so it streams behind a skeleton. */
  children: ReactNode;
};

/** Frame for the minimal auth pages (P1-04/P1-05) until P1-07 builds the designed screens. */
export function AuthPage({ title, children }: AuthPageProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <Wordmark className="self-start" />
      <h1 className="text-title text-foreground">{title}</h1>
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-md" />}>{children}</Suspense>
    </main>
  );
}
