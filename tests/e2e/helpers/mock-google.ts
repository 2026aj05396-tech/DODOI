import { OAuth2Server } from "oauth2-mock-server";

// Local stand-in for Google's OpenID provider during E2E runs (E2E-02). The app points its Google
// provider here through AUTH_GOOGLE_ISSUER (playwright.config.ts). Tests choose who signs in by
// adding `login_hint=<email>` to the authorize URL, and simulate "Cancel" on Google's consent
// screen with `mock_error=access_denied`.

export const MOCK_GOOGLE_PORT = 3199;

async function main(): Promise<void> {
  const server = new OAuth2Server();
  await server.issuer.keys.generate("RS256");

  const emailByCode = new Map<string, string>();

  server.service.on("beforeAuthorizeRedirect", (redirect: { url: URL }, req: { url?: string }) => {
    const query = new URL(req.url ?? "/", "http://mock").searchParams;
    const error = query.get("mock_error");
    if (error) {
      redirect.url.searchParams.delete("code");
      redirect.url.searchParams.set("error", error);
      return;
    }
    const code = redirect.url.searchParams.get("code");
    if (code) emailByCode.set(code, query.get("login_hint") ?? "e2e-google@example.test");
  });

  server.service.on(
    "beforeTokenSigning",
    (token: { payload: Record<string, unknown> }, req: { body?: Record<string, unknown> }) => {
      const code = typeof req.body?.code === "string" ? req.body.code : "";
      const email = emailByCode.get(code) ?? "e2e-google@example.test";
      Object.assign(token.payload, {
        sub: `google-${email}`,
        email,
        email_verified: true,
        name: "E2E Maker",
      });
    },
  );

  await server.start(MOCK_GOOGLE_PORT, "localhost");
  process.stdout.write(`Mock Google provider on ${server.issuer.url}\n`);
}

void main();
