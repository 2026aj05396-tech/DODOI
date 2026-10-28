import "server-only";

import { serverEnv } from "@/server/lib/env";

import { createResendSender, skippedEmailSender } from "./resend";
import { createSmtpSender, createSmtpTransport } from "./smtp";
import type { EmailSender } from "./types";

export type { EmailMessage, EmailSender } from "./types";

function configuredSender(): EmailSender {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, RESEND_API_KEY, EMAIL_FROM } = serverEnv;
  // SMTP wins when set: the test site uses it until a sending domain is verified in Resend.
  if (SMTP_USER && SMTP_PASSWORD) {
    const transport = createSmtpTransport({
      host: SMTP_HOST,
      user: SMTP_USER,
      password: SMTP_PASSWORD,
    });
    return createSmtpSender(transport, EMAIL_FROM);
  }
  if (RESEND_API_KEY) return createResendSender(RESEND_API_KEY, EMAIL_FROM);
  return skippedEmailSender;
}

/** The configured sender: SMTP, Resend, or a no-op when neither is set (allowed only locally). */
export const emailSender: EmailSender = configuredSender();
