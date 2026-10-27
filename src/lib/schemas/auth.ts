import { z } from "zod";

// API contracts for sign-in, registration and account checks (API_SPECIFICATION §3), shared by
// the forms and the server. Password policy: SECURITY_AND_PRIVACY §2.2.

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254));

export const signInSchema = z.object({
  email: emailSchema,
  // Sign-in only checks presence; the 10-character minimum applies when a password is set.
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX_LENGTH),
});

export type SignInInput = z.output<typeof signInSchema>;

/** Calendar date as typed by the user (`YYYY-MM-DD`); range checks happen on the server. */
export const dateOfBirthSchema = z.iso.date("Enter your date of birth.");

/** A password being set (registration, reset, change). Not-the-email is checked where known. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`);

export const PASSWORD_IS_EMAIL_MESSAGE = "Your password can't be your email address.";

export const registerSchema = z
  .object({
    email: emailSchema,
    password: newPasswordSchema,
    dateOfBirth: dateOfBirthSchema,
  })
  .refine((input) => input.password.trim().toLowerCase() !== input.email, {
    path: ["password"],
    message: PASSWORD_IS_EMAIL_MESSAGE,
  });

export type RegisterInput = z.output<typeof registerSchema>;

export const confirmAgeSchema = z.object({ dateOfBirth: dateOfBirthSchema });

export type ConfirmAgeInput = z.output<typeof confirmAgeSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1).max(200),
});

export type VerifyEmailInput = z.output<typeof verifyEmailSchema>;

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export type PasswordResetRequestInput = z.output<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1).max(200),
  newPassword: newPasswordSchema,
});

export type PasswordResetConfirmInput = z.output<typeof passwordResetConfirmSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(PASSWORD_MAX_LENGTH),
  newPassword: newPasswordSchema,
});

export type ChangePasswordInput = z.output<typeof changePasswordSchema>;

/** DELETE /api/account: accounts with a password confirm with it; Google-only accounts send none. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX_LENGTH).optional(),
});

export type DeleteAccountInput = z.output<typeof deleteAccountSchema>;
