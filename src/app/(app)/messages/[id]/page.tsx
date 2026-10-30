import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ChatSkeleton } from "@/components/companion/chat-skeleton";
import { ConversationView } from "@/components/messages/conversation-view";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { getConversation } from "@/server/modules/messages";

export const metadata: Metadata = {
  title: "Messages · dodoi",
  robots: { index: false, follow: false },
};

type Params = PageProps<"/messages/[id]">["params"];

// One conversation (F-29): only its two people can open it; anyone else, and a pair that blocked
// each other, sees not found.
export default function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ConversationContent params={params} />
    </Suspense>
  );
}

async function ConversationContent({ params }: { params: Params }) {
  const actor = await getActor();
  const { id } = await params;
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/messages/${id}`)}`);
  const conversation = await orNotFound(getConversation(actor, id));
  return (
    <ConversationView
      key={conversation.id}
      initial={conversation}
      isVerified={actor.isEmailVerified}
    />
  );
}
