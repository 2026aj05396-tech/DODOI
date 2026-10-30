import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { getActor } from "@/server/auth";

export const metadata: Metadata = {
  title: "Messages · dodoi",
  robots: { index: false, follow: false },
};

// `/messages`: below 1280px the list of conversations (drawn by the layout) is the whole page; from
// 1280px this is the empty pane beside it.
export default async function MessagesPage() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fmessages");
  return (
    <div className="m-auto">
      <EmptyState
        icon={<MessageCircle />}
        title="Pick a conversation"
        description="Or use New message to find a maker."
      />
    </div>
  );
}
