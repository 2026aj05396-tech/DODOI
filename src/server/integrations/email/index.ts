import "server-only";

import { serverEnv } from "@/server/lib/env";

import { createResendSender, skippedEmailSender } from "./resend";
import type { EmailSender } from "./types";

export type { EmailMessage, EmailSender } from "./types";

/** The configured sender: Resend, or a no-op when the key is absent (allowed only locally). */
export const emailSender: EmailSender = serverEnv.RESEND_API_KEY
  ? createResendSender(serverEnv.RESEND_API_KEY, serverEnv.EMAIL_FROM)
  : skippedEmailSender;
