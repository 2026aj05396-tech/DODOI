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
  /** Optional: this account becomes ADMIN after its first sign-in with a verified email. */
  SEED_ADMIN_EMAIL: z
    .email()
    .transform((email) => email.toLowerCase())
    .optional(),
  // Resend (P1-05). The key may be left empty only when APP_ENV is local (automated tests):
  // emails are then skipped, never sent.
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((key) => key || undefined),
  /** Sender, e.g. `dodoi <onboarding@resend.dev>`. */
  EMAIL_FROM: z.string().min(3),
});

const serverEnvWithRulesSchema = serverEnvSchema.superRefine((env, context) => {
  if (env.APP_ENV !== "local" && !env.RESEND_API_KEY) {
    context.addIssue({
      code: "custom",
      path: ["RESEND_API_KEY"],
      message: "RESEND_API_KEY is required outside local development",
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
