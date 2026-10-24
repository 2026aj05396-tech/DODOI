// Email provider contract (SYSTEM_ARCHITECTURE §4, provider abstraction). Modules depend on this,
// never on Resend directly, so tests can pass a fake and the provider can change.

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain-text body; always sent alongside the HTML for clients that block HTML. */
  text: string;
  html: string;
  /** Short, non-sensitive label for logs, e.g. "email-verification". */
  tag: string;
};

export interface EmailSender {
  /** Sends one message. Throws if the provider rejects it. */
  send(message: EmailMessage): Promise<void>;
}
