import { z } from "zod";

// Shared by the sign-in form and the Credentials provider (SECURITY_AND_PRIVACY §2.2).

export const PASSWORD_MAX_LENGTH = 128;

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.").max(254)),
  // Sign-in only checks presence; the 10-character minimum applies when a password is set.
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX_LENGTH),
});

export type SignInInput = z.output<typeof signInSchema>;
