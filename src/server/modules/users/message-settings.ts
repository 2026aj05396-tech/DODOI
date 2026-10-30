import "server-only";

import type { MessageSettingsInput } from "@/lib/schemas/messages";
import type { MessageSettings } from "@/lib/types/messages";
import type { Actor } from "@/server/lib/actor";
import { UnauthenticatedError } from "@/server/lib/errors";

import { findMessagePolicy, updateMessagePolicy } from "./repository";

// "Who can message me" (MSG-02, F-29 step 4): Everyone (default), People I follow, No one.

/** GET /api/me/message-settings. */
export async function getMessageSettings(actor: Actor): Promise<MessageSettings> {
  if (!actor) throw new UnauthenticatedError();
  return { messagePolicy: (await findMessagePolicy(actor.id)) ?? "EVERYONE" };
}

/** PUT /api/me/message-settings. */
export async function updateMessageSettings(
  actor: Actor,
  input: MessageSettingsInput,
): Promise<MessageSettings> {
  if (!actor) throw new UnauthenticatedError();
  await updateMessagePolicy(actor.id, input.messagePolicy);
  return { messagePolicy: input.messagePolicy };
}

/** What another member's setting is, for the messages module (null when the user is gone). */
export async function getMessagePolicy(
  userId: string,
): Promise<MessageSettings["messagePolicy"] | null> {
  return findMessagePolicy(userId);
}
