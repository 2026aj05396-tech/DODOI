import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/auth-page";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password · dodoi",
};

// F-04 step 1 (P1-06 minimal version; P1-07 builds the designed screen).
export default function ForgotPasswordPage() {
  return (
    <AuthPage title="Forgot your password?">
      <ForgotPasswordForm />
    </AuthPage>
  );
}
