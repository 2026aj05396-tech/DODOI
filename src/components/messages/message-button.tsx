"use client";

import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { startConversation } from "@/lib/api-client/messages";
import { ApiRequestError } from "@/lib/api-client/request";

// "Message" on a profile and on a help response (F-29 step 1, MSG-01): opens the conversation with
// that person, starting it when it is new.

export function MessageButton({
  username,
  size = "sm",
  label = "Message",
}: {
  username: string;
  size?: "sm" | "md";
  label?: string;
}) {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);

  async function open() {
    setIsOpening(true);
    try {
      const { id } = await startConversation(username);
      router.push(`/messages/${id}`);
    } catch (caught) {
      setIsOpening(false);
      showToast({
        message:
          caught instanceof ApiRequestError ? caught.message : "We couldn't open that. Try again.",
      });
    }
  }

  return (
    <Button
      variant="outline"
      size={size}
      disabled={isOpening}
      aria-label={`${label} @${username}`}
      onClick={() => void open()}
    >
      <MessageSquare aria-hidden className="size-4" />
      {isOpening ? "Opening…" : label}
    </Button>
  );
}
