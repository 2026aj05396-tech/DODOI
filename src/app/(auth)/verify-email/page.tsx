import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/auth-page";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";
import { firstSearchParam } from "@/lib/utils/search-params";
import { getActor } from "@/server/auth";

export const metadata: Metadata = {
  title: "Confirm your email · dodoi",
  // The URL carries a single-use token: keep it out of referrers and search engines.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// Opened from the verification email (F-02 step 4; P1-07 restyles it).
export default function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  return (
    <AuthPage title="Confirm your email">
      <VerifyEmailContent searchParams={searchParams} />
    </AuthPage>
  );
}

async function VerifyEmailContent({
  searchParams,
}: Pick<PageProps<"/verify-email">, "searchParams">) {
  const token = firstSearchParam((await searchParams).token) ?? null;
  const actor = await getActor();
  return <VerifyEmailPanel token={token} signedIn={actor !== null} />;
}
