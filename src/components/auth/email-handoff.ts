// Carries a typed email between auth pages (sign-up → sign-in, sign-in → forgot password)
// without putting it in the URL,
// where it would end up in browser history and server logs (SECURITY_AND_PRIVACY §7).
// sessionStorage is per tab and can be unavailable (private mode), so failures are ignored.

const KEY = "dodoi:sign-in-email";

export function rememberEmailForSignIn(email: string): void {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    // Pre-filling is a convenience; without storage the field just starts empty.
  }
}

/**
 * The remembered email, if any. Not removed on read: the sign-in form can mount more than once
 * during a navigation, so it calls `forgetRememberedEmail` when submitted instead.
 */
export function readRememberedEmail(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetRememberedEmail(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
