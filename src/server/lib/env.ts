import "server-only";

import { z } from "zod";

// Single place that reads process.env on the server (CODE_QUALITY §2.5). Each feature task adds
// the variables it needs here and in .env.example, so the app only demands keys that are in use.
const serverEnvSchema = z.object({
  // Deployed environment (SYSTEM_ARCHITECTURE §13). Independent of NODE_ENV.
  APP_ENV: z.enum(["local", "test", "production"]),
  DATABASE_URL: z.url(),
  // Auth.js (SECURITY_AND_PRIVACY §2). The secret encrypts session JWTs; generate with `npx auth secret`.
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  /** Public origin of this deployment; Auth.js builds OAuth callback URLs from it. */
  AUTH_URL: z.url(),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  /**
   * Automated tests only (APP_ENV=local): a local mock OpenID provider used instead of Google
   * (tests/e2e/helpers/mock-google.ts). Never set it anywhere else.
   */
  AUTH_GOOGLE_ISSUER: z
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** Optional: shown to owners of profiles hidden after a report (P1-28b); set before launch. */
  SUPPORT_EMAIL: z
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * Hosted environments (P1-35): Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>` when
   * it calls /api/cron/daily. Required outside local; at least 32 random characters.
   */
  CRON_SECRET: z
    .string()
    .min(32, "CRON_SECRET must be at least 32 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** Optional: this account becomes ADMIN after its first sign-in with a verified email. */
  SEED_ADMIN_EMAIL: z
    .email()
    .transform((email) => email.toLowerCase())
    .optional(),
  // Resend (P1-05). The key may be left empty when SMTP is used instead (below), or when APP_ENV
  // is local (automated tests): emails are then skipped, never sent.
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((key) => key || undefined),
  /**
   * SMTP instead of Resend (P1-35): the test site sends from a Gmail account with an App Password
   * until a sending domain is verified. When both user and password are set, SMTP is used.
   */
  SMTP_HOST: z.string().min(1).default("smtp.gmail.com"),
  SMTP_USER: z
    .string()
    .optional()
    .transform((user) => user || undefined),
  SMTP_PASSWORD: z
    .string()
    .optional()
    .transform((password) => password || undefined),
  /** Sender, e.g. `dodoi <onboarding@resend.dev>`; with Gmail SMTP, that Gmail address. */
  EMAIL_FROM: z.string().min(3),
  // Cloudinary (P1-03): server only; uploads are signed, never unsigned presets.
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  /**
   * Automated tests only (APP_ENV=local): a local stand-in for Cloudinary's Admin API
   * (tests/e2e/helpers/mock-cloudinary.ts). Never set it anywhere else.
   */
  CLOUDINARY_API_BASE: z
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const serverEnvWithRulesSchema = serverEnvSchema.superRefine((env, context) => {
  if (env.APP_ENV !== "local" && env.CLOUDINARY_API_BASE) {
    context.addIssue({
      code: "custom",
      path: ["CLOUDINARY_API_BASE"],
      message: "CLOUDINARY_API_BASE is for automated local tests only",
    });
  }
  if (env.APP_ENV !== "local" && env.AUTH_GOOGLE_ISSUER) {
    context.addIssue({
      code: "custom",
      path: ["AUTH_GOOGLE_ISSUER"],
      message: "AUTH_GOOGLE_ISSUER is for automated local tests only",
    });
  }
  if (env.APP_ENV !== "local" && !env.CRON_SECRET) {
    context.addIssue({
      code: "custom",
      path: ["CRON_SECRET"],
      message: "CRON_SECRET is required outside local development (daily jobs)",
    });
  }
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
    context.addIssue({
      code: "custom",
      path: [env.SMTP_USER ? "SMTP_PASSWORD" : "SMTP_USER"],
      message: "SMTP_USER and SMTP_PASSWORD are set together",
    });
  }
  if (env.APP_ENV !== "local" && !env.RESEND_API_KEY && !env.SMTP_USER) {
    context.addIssue({
      code: "custom",
      path: ["RESEND_API_KEY"],
      message:
        "RESEND_API_KEY (or SMTP_USER and SMTP_PASSWORD) is required outside local development",
    });
  }
});

export type ServerEnv = z.output<typeof serverEnvSchema>;

/** Validates environment variables and throws a readable error listing every problem. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvWithRulesSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}\n` +
        "Check .env.local against .env.example.",
    );
  }
  return result.data;
}

export const serverEnv = parseServerEnv(process.env);
