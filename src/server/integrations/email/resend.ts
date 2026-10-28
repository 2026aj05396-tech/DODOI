import "server-only";

import { logger } from "@/server/lib/logger";

import type { EmailSender } from "./types";

// Resend over its REST API (https://resend.com/docs/api-reference/emails/send-email), which keeps
// the SDK dependency out for a single call.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;

export function createResendSender(apiKey: string, from: string): EmailSender {
  return {
    async send(message) {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          tags: [{ name: "type", value: message.tag.replaceAll("-", "_") }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        // The body explains the rejection (e.g. unverified domain); it never contains the message.
        const detail = (await response.text()).slice(0, 500);
        throw new Error(`Resend rejected the email (${response.status}): ${detail}`);
      }
    },
  };
}

/** Used when no provider is configured (automated local test runs): nothing is sent. */
export const skippedEmailSender: EmailSender = {
  async send(message) {
    logger.info("Email skipped: no RESEND_API_KEY or SMTP settings", { tag: message.tag });
  },
};
