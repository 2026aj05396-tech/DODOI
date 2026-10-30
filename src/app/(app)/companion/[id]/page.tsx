import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ChatScreen } from "@/components/companion/chat-screen";
import { ChatSkeleton } from "@/components/companion/chat-skeleton";
import { getActor } from "@/server/auth";
import { orNotFound } from "@/server/lib/not-found";
import { getCompanionSetup, getConversation } from "@/server/modules/ai";

export const metadata: Metadata = {
  title: "Chat · dodoi",
  robots: { index: false, follow: false },
};

type Params = PageProps<"/companion/[id]">["params"];

// An earlier chat (F-23 step 2): only its owner can open it; anyone else sees not found.
export default function ChatPage({ params }: PageProps<"/companion/[id]">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatContent params={params} />
    </Suspense>
  );
}

async function ChatContent({ params }: { params: Params }) {
  const actor = await getActor();
  const { id } = await params;
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/companion/${id}`)}`);
  const [conversation, setup] = await Promise.all([
    orNotFound(getConversation(actor, id)),
    getCompanionSetup(actor),
  ]);
  return (
    <ChatScreen
      key={conversation.id}
      setup={setup}
      isVerified={actor.isEmailVerified}
      conversationId={conversation.id}
      initialMessages={conversation.messages}
      context={conversation.context}
    />
  );
}
