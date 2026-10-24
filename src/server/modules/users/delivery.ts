import "server-only";

import type { EmailMessage, EmailSender } from "@/server/integrations/email";
import { serverEnv } from "@/server/lib/env";
import { logger } from "@/server/lib/logger";

/** Absolute link into the app, built from AUTH_URL (the deployment's public origin). */
export function appUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(path, serverEnv.AUTH_URL);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url.toString();
}

/** For emails nobody waits on: failures are logged, never shown (the person can ask again). */
export async function sendQuietly(sender: EmailSender, message: EmailMessage): Promise<void> {
  try {
    await sender.send(message);
  } catch (error) {
    logger.error("Email could not be sent", { tag: message.tag, error });
  }
}
