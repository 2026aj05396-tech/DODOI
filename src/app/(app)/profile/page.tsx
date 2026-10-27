import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getActor } from "@/server/auth";
import { getMyProfile } from "@/server/modules/library";

// "Profile" in the navigation (P1-14): forwards to the signed-in user's own `/u/{username}`.
export default function ProfileRedirectPage() {
  return (
    <Suspense fallback={null}>
      <ToOwnProfile />
    </Suspense>
  );
}

async function ToOwnProfile(): Promise<null> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fprofile");
  const profile = await getMyProfile(actor);
  redirect(`/u/${profile.username}`);
}
