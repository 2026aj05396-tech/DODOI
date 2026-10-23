import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";
import { toSignInErrorMessage } from "@/components/auth/sign-in-messages";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wordmark } from "@/components/ui/wordmark";
import { toSafeReturnPath } from "@/lib/utils/safe-return-path";
import { getActor } from "@/server/auth";

export const metadata: Metadata = {
  title: "Sign in · dodoi",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Sign-in page (P1-04 minimal version; P1-07 builds the designed screen). The proxy sends
// signed-out visitors here with `returnTo`; Auth.js adds `error` after a failed Google sign-in.
export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <Wordmark className="self-start" />
      <h1 className="text-title text-foreground">Sign in</h1>
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-md" />}>
        <SignInPanel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignInPanel({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams;
  // Auth.js uses `callbackUrl`; our proxy uses `returnTo`. Both are checked the same way.
  const returnTo = toSafeReturnPath(firstValue(params.returnTo) ?? firstValue(params.callbackUrl));
  const actor = await getActor();

  if (actor) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body text-foreground-secondary">You&apos;re signed in.</p>
        <Button asChild size="lg">
          <Link href={returnTo}>Continue</Link>
        </Button>
        <SignOutButton />
      </div>
    );
  }

  return (
    <SignInForm
      returnTo={returnTo}
      initialError={toSignInErrorMessage(firstValue(params.error), firstValue(params.code))}
    />
  );
}
