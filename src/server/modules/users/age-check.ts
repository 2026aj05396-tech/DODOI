import "server-only";

import type { ConfirmAgeInput } from "@/lib/schemas/auth";
import type { Actor } from "@/server/lib/actor";
import { UnauthenticatedError, UnprocessableError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";

import { checkDateOfBirth } from "./age";
import { invalidDateOfBirth, UNDER_MINIMUM_AGE_MESSAGE } from "./registration";
import { deleteUserById, findAccountState, setAgeConfirmed } from "./repository";

/**
 * Date-of-birth step after a first Google sign-in (POST /api/account/age, AUTH-11). Adults get
 * `ageConfirmedAt`; under-18s have the account deleted (SECURITY_AND_PRIVACY §2.7) and the caller
 * signs them out. Already-confirmed accounts are left unchanged.
 */
export async function confirmAge(
  actor: Actor,
  input: ConfirmAgeInput,
  now = new Date(),
): Promise<void> {
  if (!actor) throw new UnauthenticatedError();
  const account = await findAccountState(actor.id);
  if (!account) throw new UnauthenticatedError();
  if (account.ageConfirmedAt) return;

  const age = checkDateOfBirth(input.dateOfBirth, now);
  if (age === "invalid") throw invalidDateOfBirth();
  if (age === "under-minimum-age") {
    await deleteUserById(actor.id);
    logger.info("Deleted an account that failed the age check", { userId: actor.id });
    throw new UnprocessableError(UNDER_MINIMUM_AGE_MESSAGE, { code: "UNDER_MINIMUM_AGE" });
  }
  await setAgeConfirmed(actor.id);
}
