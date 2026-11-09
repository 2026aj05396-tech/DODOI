"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PersonPickerDialog } from "@/components/people/person-picker-dialog";
import { showToast } from "@/components/ui/toast";
import { startConversation } from "@/lib/api-client/messages";
import { ApiRequestError } from "@/lib/api-client/request";
import type { MessagePerson } from "@/lib/types/messages";

// "New message" (F-29 step 1b, MSG-06): pick a member you can message and open the conversation.

export function NewMessagePanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [openingUsername, setOpeningUsername] = useState<string | null>(null);

  async function open(person: MessagePerson) {
    if (person.conversationId) {
      router.push(`/messages/${person.conversationId}`);
      onClose();
      return;
    }
    setOpeningUsername(person.username);
    try {
      const { id } = await startConversation(person.username);
      router.push(`/messages/${id}`);
      onClose();
    } catch (caught) {
      setOpeningUsername(null);
      showToast({
        message:
          caught instanceof ApiRequestError ? caught.message : "We couldn't open that. Try again.",
      });
    }
  }

  return (
    <PersonPickerDialog
      title="New message"
      description="Search for a maker you can message, or pick one of the suggestions."
      emptyHint="Type a name or username. People you follow will show up here."
      noResultsTitle="No one found that you can message"
      pendingUsername={openingUsername}
      onPick={(person) => void open(person)}
      onClose={onClose}
    />
  );
}
