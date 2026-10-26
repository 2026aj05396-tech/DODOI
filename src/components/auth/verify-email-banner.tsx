import { ResendVerificationButton } from "./resend-verification-button";

/**
 * Shown on signed-in pages while the email is unverified (OD-08): private features work, sharing
 * needs a verified email. Not designed: built from the design system (P1-07, PO review).
 */
export function VerifyEmailBanner() {
  return (
    <aside
      aria-label="Verify your email"
      className="mx-5 mt-4 flex flex-col gap-3 rounded-card bg-butter p-4 md:mx-7 md:flex-row md:items-center md:justify-between"
    >
      <p className="text-body text-foreground">
        <strong className="font-bold">Verify your email to share with the community.</strong> Open
        the link we sent you, or get a new one.
      </p>
      <ResendVerificationButton size="md" />
    </aside>
  );
}
