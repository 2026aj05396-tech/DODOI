// User-facing messages for Auth.js sign-in failures. Auth.js reports them as `error` (the error
// type) and, for the Credentials provider, `code` (see RateLimitedSignIn in src/server/auth).

const GENERIC_MESSAGE = "Something went wrong signing you in. Please try again.";

const MESSAGES_BY_CODE: Record<string, string> = {
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
};

const MESSAGES_BY_ERROR: Record<string, string> = {
  CredentialsSignin: "That email and password don't match. Check them and try again.",
  AccessDenied: "We couldn't sign you in with Google. Try again, or use your email and password.",
  OAuthAccountNotLinked:
    "That Google account belongs to a different dodoi account. Sign out first, then try again.",
};

/** Message for a failed sign-in, or null when there is no error. */
export function toSignInErrorMessage(
  error: string | null | undefined,
  code?: string | null,
): string | null {
  if (!error) return null;
  return (code && MESSAGES_BY_CODE[code]) || MESSAGES_BY_ERROR[error] || GENERIC_MESSAGE;
}
