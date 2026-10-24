import type { EmailMessage } from "@/server/integrations/email/types";

// Transactional email content (AUTH-04). Email clients ignore our
// stylesheet, so these use inline styles with colours copied from tokens.css: paper #fff8f0,
// ink #2b2233, ink-2 #5a4e5e, brick #c04a37 (wordmark), white on ink for the button (inverse).
// Links are built from AUTH_URL by the caller.

type Content = { heading: string; paragraphs: string[]; action?: { label: string; url: string } };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render({ heading, paragraphs, action }: Content): { html: string; text: string } {
  const body = paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`)
    .join("");
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#2b2233;color:#ffffff;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none">${escapeHtml(action.label)}</a></p><p style="margin:0 0 16px;font-size:13px;color:#5a4e5e">Or paste this link into your browser: ${escapeHtml(action.url)}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#fff8f0;font-family:'DM Sans',Arial,sans-serif;color:#2b2233;font-size:15px;line-height:1.5"><div style="max-width:480px;margin:0 auto"><p style="font-size:24px;font-weight:700;color:#c04a37;margin:0 0 24px">dodoi</p><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>${body}${button}</div></body></html>`;
  const text = [
    heading,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(action ? [`${action.label}: ${action.url}`, ""] : []),
    "— dodoi",
  ].join("\n");
  return { html, text };
}

export function verificationEmail(to: string, verifyUrl: string): EmailMessage {
  return {
    to,
    tag: "email-verification",
    subject: "Confirm your email for dodoi",
    ...render({
      heading: "Confirm your email",
      paragraphs: [
        "Welcome to dodoi! Confirm this is your email so you can share with the community.",
        "This link works once and expires in 24 hours.",
        "If you didn't sign up for dodoi, you can ignore this email.",
      ],
      action: { label: "Confirm my email", url: verifyUrl },
    }),
  };
}

/** Reset link; for an account without a password (Google sign-up) it reads as "set a password". */
export function passwordResetEmail(
  to: string,
  resetUrl: string,
  { hasPassword }: { hasPassword: boolean },
): EmailMessage {
  const verb = hasPassword ? "Reset" : "Set";
  return {
    to,
    tag: "password-reset",
    subject: `${verb} your dodoi password`,
    ...render({
      heading: `${verb} your password`,
      paragraphs: [
        hasPassword
          ? "Someone asked to reset the password for your dodoi account. If it was you, choose a new one."
          : "Someone asked to set a password for your dodoi account, which you use with Google. If it was you, choose one — you can then sign in either way.",
        "This link works once and expires in 1 hour. Setting a new password signs you out on every device.",
        "If you didn't ask for this, you can ignore this email. Nothing changes.",
      ],
      action: { label: `${verb} my password`, url: resetUrl },
    }),
  };
}
