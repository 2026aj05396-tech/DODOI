import type {
  ChangePasswordInput,
  ConfirmAgeInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  RegisterInput,
  VerifyEmailInput,
} from "@/lib/schemas/auth";
import type { RegisterResponse } from "@/lib/types/auth";

import { postJson } from "./request";

// Account endpoints (API_SPECIFICATION §3).

export function registerAccount(input: RegisterInput): Promise<RegisterResponse> {
  return postJson<RegisterResponse>("/api/account/register", input);
}

export function confirmAge(input: ConfirmAgeInput): Promise<void> {
  return postJson("/api/account/age", input);
}

export function verifyEmail(input: VerifyEmailInput): Promise<void> {
  return postJson("/api/account/verify-email", input);
}

export function resendVerificationEmail(): Promise<void> {
  return postJson("/api/account/verify-email/resend");
}

export function requestPasswordReset(input: PasswordResetRequestInput): Promise<void> {
  return postJson("/api/account/password-reset/request", input);
}

export function confirmPasswordReset(input: PasswordResetConfirmInput): Promise<void> {
  return postJson("/api/account/password-reset/confirm", input);
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return postJson("/api/account/password", input);
}
