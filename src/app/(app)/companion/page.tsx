import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ChatScreen } from "@/components/companion/chat-screen";
import { ChatSkeleton } from "@/components/companion/chat-skeleton";
import { getActor } from "@/server/auth";
import { getCompanionSetup } from "@/server/modules/ai";

export const metadata: Metadata = {
  title: "Companion · dodoi",
  robots: { index: false, follow: false },
};

// `/companion`: below 1280px the list of past chats (drawn by the layout) is the whole page; from
// 1280px this is the empty chat beside it.
export default function CompanionPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <NewChat />
    </Suspense>
  );
}

async function NewChat() {
  const actor = await getActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent("/companion")}`);
  const setup = await getCompanionSetup(actor);
  return (
    <ChatScreen
      setup={setup}
      isVerified={actor.isEmailVerified}
      conversationId={null}
      initialMessages={[]}
      context={null}
    />
  );
}
