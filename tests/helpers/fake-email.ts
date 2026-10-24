import type { EmailMessage, EmailSender } from "@/server/integrations/email/types";

// Records emails instead of sending them (TESTING_STRATEGY §2: fake providers).
export function createFakeEmailSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}

/** The raw token from the verification link in an email's text. */
export function tokenFromEmail(message: EmailMessage | undefined): string {
  const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(message?.text ?? "");
  if (!match?.[1]) throw new Error("No verification link in the email");
  return match[1];
}
