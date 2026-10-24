import { describe, expect, it } from "vitest";

import { toSignInErrorMessage } from "./sign-in-messages";

describe("toSignInErrorMessage", () => {
  it("returns null when there is no error", () => {
    expect(toSignInErrorMessage(null)).toBeNull();
    expect(toSignInErrorMessage(undefined, "rate_limited")).toBeNull();
  });

  it("uses one message for a wrong password and an unknown email (no enumeration)", () => {
    expect(toSignInErrorMessage("CredentialsSignin", "credentials")).toBe(
      "That email and password don't match. Check them and try again.",
    );
  });

  it("points Google-only accounts to Google sign-in", () => {
    expect(toSignInErrorMessage("CredentialsSignin", "use_google")).toBe(
      "Looks like you signed up with Google, so there's no password for this account. Continue with Google instead.",
    );
  });

  it("prefers the specific code over the error type", () => {
    expect(toSignInErrorMessage("CredentialsSignin", "rate_limited")).toMatch(/Too many attempts/);
  });

  it("explains a refused Google sign-in and falls back to a generic message", () => {
    expect(toSignInErrorMessage("AccessDenied")).toMatch(/Google/);
    expect(toSignInErrorMessage("Configuration")).toBe(
      "Something went wrong signing you in. Please try again.",
    );
  });
});
