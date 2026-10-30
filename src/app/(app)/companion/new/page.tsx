import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ChatScreen } from "@/components/companion/chat-screen";
import { ChatSkeleton } from "@/components/companion/chat-skeleton";
import type { AIContextInput } from "@/lib/schemas/ai";
import type { AIContextView } from "@/lib/types/ai";
import { getActor } from "@/server/auth";
import { NotFoundError } from "@/server/lib/errors";
import { orNotFound } from "@/server/lib/not-found";
import { getCompanionSetup } from "@/server/modules/ai";
import { getPostDetail } from "@/server/modules/content";
import { getActiveSkillSummaries } from "@/server/modules/skills";

export const metadata: Metadata = {
  title: "New chat · dodoi",
  robots: { index: false, follow: false },
};

const SKILL_QUESTION = "What is this and how do I start?";

type SearchParams = PageProps<"/companion/new">["searchParams"];

// A new chat (F-23 step 1): `?post={id}` asks about a post, `?skill={id}` about a skill ("Ask about
// this", "What is this and how do I start?"); without either it is a general chat.
export default function NewChatPage({ searchParams }: PageProps<"/companion/new">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <NewChatContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewChatContent({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getActor();
  const query = await searchParams;
  const postId = typeof query.post === "string" ? query.post : null;
  const skillId = typeof query.skill === "string" ? query.skill : null;
  if (!actor) {
    const returnTo = `/companion/new${postId ? `?post=${encodeURIComponent(postId)}` : skillId ? `?skill=${encodeURIComponent(skillId)}` : ""}`;
    redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  }

  let newContext: AIContextInput | null = null;
  let context: AIContextView = null;
  if (postId) {
    const post = await orNotFound(getPostDetail(actor, postId));
    newContext = { type: "POST", id: post.id };
    context = { type: "POST", id: post.id, title: post.title };
  } else if (skillId) {
    const skill = (await getActiveSkillSummaries([skillId])).get(skillId);
    if (!skill) throw new NotFoundError("We couldn't find that skill.");
    newContext = { type: "SKILL", id: skillId };
    context = { type: "SKILL", id: skillId, title: skill.name };
  }

  const setup = await getCompanionSetup(actor);
  return (
    <ChatScreen
      setup={setup}
      isVerified={actor.isEmailVerified}
      conversationId={null}
      initialMessages={[]}
      context={context}
      newContext={newContext}
      initialDraft={skillId ? SKILL_QUESTION : ""}
      backHref={postId ? `/p/${postId}` : "/companion"}
    />
  );
}
