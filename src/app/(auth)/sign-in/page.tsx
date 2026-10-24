import type { Metadata } from "next";
import Link from "next/link";

import { AuthPage } from "@/components/auth/auth-page";
import { SignInForm } from "@/components/auth/sign-in-form";
import { toSignInErrorMessage } from "@/components/auth/sign-in-messages";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { toSafeReturnPath } from "@/lib/utils/safe-return-path";
import { firstSearchParam } from "@/lib/utils/search-params";
import { getActor } from "@/server/auth";

export const metadata: Metadata = {
  title: "Sign in · dodoi",
};

// Sign-in page (P1-04 minimal version; P1-07 builds the designed screen). The proxy sends
// signed-out visitors here with `returnTo`; Auth.js adds `error` after a failed Google sign-in.
export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthPage title="Sign in">
      <SignInPanel searchParams={searchParams} />
    </AuthPage>
  );
}

async function SignInPanel({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams;
  // Auth.js uses `callbackUrl`; our proxy uses `returnTo`. Both are checked the same way.
  const returnTo = toSafeReturnPath(
    firstSearchParam(params.returnTo) ?? firstSearchParam(params.callbackUrl),
  );
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
    <div className="flex flex-col gap-5">
      <SignInForm
        returnTo={returnTo}
        initialError={toSignInErrorMessage(
          firstSearchParam(params.error),
          firstSearchParam(params.code),
        )}
      />
      <p className="text-center text-body text-foreground-secondary">
        New to dodoi?{" "}
        <Link
          href={`/sign-up?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-bold text-link hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
