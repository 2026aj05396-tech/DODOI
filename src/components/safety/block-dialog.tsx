"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { showToast } from "@/components/ui/toast";
import { blockUser } from "@/lib/api-client/blocks";
import { ApiRequestError } from "@/lib/api-client/request";

// "Block @name?" (MOD-02, F-22 step 2): both stop seeing each other's profile, posts and comments,
// and follows are removed. The other person is not told. After blocking, back to the previous
// page with a toast; their content is gone from it.

export function BlockDialog({ username, onClose }: { username: string; onClose: () => void }) {
  const router = useRouter();
  const [isBlocking, setIsBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function block() {
    setIsBlocking(true);
    setError(null);
    try {
      await blockUser(username);
      showToast({ message: `Blocked @${username}` });
      onClose();
      if (window.history.length > 1) router.back();
      else router.replace("/feed");
      router.refresh();
    } catch (caught) {
      setIsBlocking(false);
      setError(
        caught instanceof ApiRequestError ? caught.message : "We couldn't block them. Try again.",
      );
    }
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent>
        <DialogTitle>Block @{username}?</DialogTitle>
        <DialogDescription>
          You won&apos;t see each other&apos;s posts, comments or profile, and follows are removed.
          They won&apos;t be told.
        </DialogDescription>
        <FieldError id="block-error">{error}</FieldError>
        <div className="flex justify-end gap-2.5">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" disabled={isBlocking} onClick={() => void block()}>
            {isBlocking ? "Blocking…" : "Block"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
