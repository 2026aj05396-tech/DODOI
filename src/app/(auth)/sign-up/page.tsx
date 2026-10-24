import type { Metadata } from "next";
import Link from "next/link";

import { AuthPage } from "@/components/auth/auth-page";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { toSafeReturnPath } from "@/lib/utils/safe-return-path";
import { firstSearchParam } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "Create your account · dodoi",
};

// Email sign-up (F-02; P1-05 minimal version, P1-07 builds the designed screen).
export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <AuthPage title="Create your account">
      <SignUpPanel searchParams={searchParams} />
    </AuthPage>
  );
}

async function SignUpPanel({ searchParams }: Pick<PageProps<"/sign-up">, "searchParams">) {
  const returnTo = toSafeReturnPath(firstSearchParam((await searchParams).returnTo));
  return (
    <div className="flex flex-col gap-5">
      <SignUpForm returnTo={returnTo} />
      <p className="text-center text-body text-foreground-secondary">
        Already have an account?{" "}
        <Link
          href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-bold text-link hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
