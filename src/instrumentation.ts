// Runs once when a Next.js server starts. Importing the env module validates environment
// variables, so a misconfigured server fails at startup instead of on the first request.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/server/lib/env");
  }
}
