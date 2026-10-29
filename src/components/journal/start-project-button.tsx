"use client";

import { NotebookPen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { startProjectFromPost } from "@/lib/api-client/journal";
import { ApiRequestError } from "@/lib/api-client/request";

// "Start as my project" on a tutorial (JRN-03, F-18 step 2): a private project in the journal with
// the tutorial's materials as a checklist. Signed-out visitors sign in first.

export function StartProjectButton({
  postId,
  isSignedIn,
  className,
}: {
  postId: string;
  isSignedIn: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const label = (
    <>
      <NotebookPen aria-hidden className="size-4" />
      Start as my project
    </>
  );

  if (!isSignedIn) {
    return (
      <Button asChild variant="outline" className={className}>
        <Link href={`/sign-in?returnTo=${encodeURIComponent(`/p/${postId}`)}`}>{label}</Link>
      </Button>
    );
  }

  async function start() {
    setIsStarting(true);
    try {
      const project = await startProjectFromPost(postId);
      showToast({ message: "Project started. It's in your journal." });
      router.push(`/projects/${project.id}`);
    } catch (error) {
      setIsStarting(false);
      showToast({
        message: error instanceof ApiRequestError ? error.message : "We couldn't start it.",
      });
    }
  }

  return (
    <Button
      variant="outline"
      className={className}
      onClick={() => void start()}
      disabled={isStarting}
    >
      {label}
    </Button>
  );
}
