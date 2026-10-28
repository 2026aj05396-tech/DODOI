import "server-only";

import { createTransport } from "nodemailer";

import type { EmailSender } from "./types";

// SMTP through nodemailer, for environments without a verified sending domain (P1-35: the test
// site sends from a Gmail account with an App Password). Port 465 is TLS from the first byte.

const SMTP_PORT = 465;
const TIMEOUT_MS = 10_000;

/** The one call this sender needs from a nodemailer transport; tests pass a fake. */
export type SmtpTransport = {
  sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
};

export type SmtpSettings = { host: string; user: string; password: string };

export function createSmtpTransport({ host, user, password }: SmtpSettings): SmtpTransport {
  return createTransport({
    host,
    port: SMTP_PORT,
    secure: true,
    auth: { user, pass: password },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}

export function createSmtpSender(transport: SmtpTransport, from: string): EmailSender {
  return {
    async send(message) {
      try {
        await transport.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      } catch (error) {
        // Nodemailer's message names the SMTP failure (e.g. bad credentials); never the content.
        const detail = error instanceof Error ? error.message.slice(0, 500) : "unknown error";
        throw new Error(`SMTP rejected the email: ${detail}`);
      }
    },
  };
}
