import type { Metadata } from "next";

import { FollowList } from "@/components/profile/follow-list";
import { BackButton } from "@/components/ui/back-button";

export const metadata: Metadata = {
  title: "Following · dodoi",
};

// Following list (P2-06, FLW-03): your own, reached from your profile. Signed-out visitors are sent to
// sign-in by the proxy.
export default function FollowingPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 pt-4 pb-10 md:px-7 md:pt-8">
      <BackButton fallbackHref="/profile" />
      <h1 className="mt-2 mb-4 text-title text-foreground md:text-title-web">Following</h1>
      <FollowList list="following" />
    </div>
  );
}
