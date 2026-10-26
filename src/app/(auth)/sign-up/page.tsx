import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/auth-page";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { toSafeReturnPath } from "@/lib/utils/safe-return-path";
import { firstSearchParam } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "Create your account · dodoi",
};

// Email sign-up (F-02). Not designed: built from the design system (P1-07). The form renders its
// own heading, which becomes "Check your email" after registering.
export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <AuthPage>
      <SignUpPanel searchParams={searchParams} />
    </AuthPage>
  );
}

async function SignUpPanel({ searchParams }: Pick<PageProps<"/sign-up">, "searchParams">) {
  const returnTo = toSafeReturnPath(firstSearchParam((await searchParams).returnTo));
  return <SignUpForm returnTo={returnTo} />;
}
