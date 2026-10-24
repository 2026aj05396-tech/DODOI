import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/auth-page";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { firstSearchParam } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "Choose a new password · dodoi",
  // The URL carries a single-use token: keep it out of referrers and search engines.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// Opened from the reset email (F-04 step 3; P1-07 restyles it).
export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <AuthPage title="Choose a new password">
      <ResetPasswordContent searchParams={searchParams} />
    </AuthPage>
  );
}

async function ResetPasswordContent({
  searchParams,
}: Pick<PageProps<"/reset-password">, "searchParams">) {
  const token = firstSearchParam((await searchParams).token) ?? null;
  return <ResetPasswordForm token={token} />;
}
