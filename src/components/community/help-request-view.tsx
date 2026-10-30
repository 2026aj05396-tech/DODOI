"use client";

import { Check, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ConfirmDeleteDialog } from "@/components/companion/confirm-delete-dialog";
import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Label, Textarea } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import {
  createHelpResponse,
  deleteHelpRequest,
  setHelpRequestStatus,
  setResponseHelpful,
} from "@/lib/api-client/help";
import { ApiRequestError } from "@/lib/api-client/request";
import { HELP_RESPONSE_MAX, type HelpStatusName } from "@/lib/schemas/help";
import type { HelpRequestDetail } from "@/lib/types/help";
import type { CreatorSummary } from "@/lib/types/posts";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/time-ago";

import { HelpMenu } from "./help-menu";
import { StatusChip } from "./help-request-card";

// A help request and its responses (HLP-02, F-27 steps 2–4; not designed, built from the system).
// Everyone signed in can read; verified members who are not the asker can answer; only the asker
// changes the status, marks a response helpful, or deletes the request.

function Person({ author, fallback }: { author: CreatorSummary | null; fallback: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar url={author?.avatarUrl ?? null} className="size-8 shrink-0" />
      <span className="truncate text-control font-bold text-foreground">
        {author?.displayName ?? fallback}
      </span>
    </span>
  );
}

export function HelpRequestView({
  initial,
  isVerified,
}: {
  initial: HelpRequestDetail;
  isVerified: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [request, setRequest] = useState(initial);
  const [reply, setReply] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  function messageOf(caught: unknown, fallback: string): string {
    return caught instanceof ApiRequestError ? caught.message : fallback;
  }

  async function changeStatus(status: HelpStatusName) {
    setIsBusy(true);
    setError(null);
    try {
      setRequest(await setHelpRequestStatus(request.id, status));
    } catch (caught) {
      setError(messageOf(caught, "We couldn't change that."));
    } finally {
      setIsBusy(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      setRequest(await createHelpResponse(request.id, { body: reply.trim() }));
      setReply("");
    } catch (caught) {
      setError(messageOf(caught, "We couldn't send that. Try again."));
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleHelpful(responseId: string, isHelpful: boolean) {
    const before = request;
    setRequest({
      ...request,
      responses: request.responses.map((response) =>
        response.id === responseId ? { ...response, isHelpful } : response,
      ),
    });
    try {
      await setResponseHelpful(responseId, isHelpful);
    } catch (caught) {
      setRequest(before);
      showToast({ message: messageOf(caught, "We couldn't save that.") });
    }
  }

  async function remove() {
    setIsDeleting(true);
    try {
      await deleteHelpRequest(request.id);
      showToast({ message: "Request deleted" });
      router.replace("/community");
    } catch (caught) {
      setIsDeleting(false);
      showToast({ message: messageOf(caught, "We couldn't delete that.") });
    }
  }

  const replyNotice = request.isOwn
    ? null
    : request.status === "RESOLVED"
      ? "This request is resolved."
      : !isVerified
        ? "Verify your email to offer help."
        : null;

  return (
    <div className="flex flex-col gap-6">
      {request.isHidden ? (
        <p
          role="status"
          className="rounded-md bg-destructive-surface p-3.5 text-body text-foreground"
        >
          <span className="font-bold">Hidden after a report.</span> Only you and our team can see
          this request.
        </p>
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {request.skill ? (
            <span className="rounded-full bg-lavender px-3 py-1 text-meta font-bold text-plum">
              {request.skill.name}
            </span>
          ) : null}
          <StatusChip status={request.status} />
        </div>
        <h1 className="text-title text-balance wrap-break-word text-foreground md:text-title-web">
          {request.title}
        </h1>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Person author={request.author} fallback="A maker" />
            <p className="mt-1 text-meta text-foreground-secondary">
              {request.isOwn ? "You asked" : "Asked"} {timeAgo(request.createdAt)}
            </p>
          </div>
          {!request.isOwn ? (
            <HelpMenu
              target={{ type: "HELP_REQUEST", id: request.id }}
              label="request"
              author={request.author}
            />
          ) : null}
        </div>
      </header>

      <p className="text-body-lg wrap-break-word whitespace-pre-line text-foreground md:text-body-lg-web">
        {request.body}
      </p>

      {request.photos.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {request.photos.map((photo, index) => (
            <li key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet. */}
              <img
                src={photo.url}
                srcSet={photo.srcSet}
                sizes="(min-width: 768px) 320px, 90vw"
                alt={photo.altText ?? `Photo ${index + 1} from the request`}
                width={photo.width}
                height={photo.height}
                className="max-h-80 w-auto max-w-full rounded-card object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {request.isOwn ? (
        <section aria-label="Manage this request" className="flex flex-wrap gap-2.5">
          {request.status === "OPEN" ? (
            <Button
              variant="outline"
              disabled={isBusy}
              onClick={() => void changeStatus("IN_PROGRESS")}
            >
              Mark as in progress
            </Button>
          ) : null}
          {request.status !== "RESOLVED" ? (
            <Button disabled={isBusy} onClick={() => void changeStatus("RESOLVED")}>
              <Check aria-hidden className="size-4" />
              Mark as resolved
            </Button>
          ) : (
            <Button variant="outline" disabled={isBusy} onClick={() => void changeStatus("OPEN")}>
              Reopen
            </Button>
          )}
          <Button
            variant="text"
            className="text-destructive"
            onClick={() => setIsConfirmingDelete(true)}
          >
            Delete request
          </Button>
        </section>
      ) : null}

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <section aria-labelledby={`${id}-responses`} className="flex flex-col gap-3">
        <h2 id={`${id}-responses`} className="text-section text-foreground">
          {request.responses.length === 0
            ? "No replies yet"
            : request.responses.length === 1
              ? "1 reply"
              : `${request.responses.length} replies`}
        </h2>
        <ul className="flex flex-col gap-3">
          {request.responses.map((response) => (
            <li
              key={response.id}
              id={`response-${response.id}`}
              className={cn(
                "flex flex-col gap-2.5 rounded-card border bg-background p-4",
                response.isHelpful ? "border-success" : "border-border",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Person author={response.author} fallback="A maker" />
                  <p className="mt-1 text-meta text-foreground-secondary">
                    {timeAgo(response.createdAt)}
                  </p>
                </div>
                {response.isHelpful ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-meta font-bold text-foreground">
                    <ThumbsUp aria-hidden className="size-3.5" />
                    Helpful
                  </span>
                ) : null}
                {!response.isOwn ? (
                  <HelpMenu
                    target={{ type: "HELP_RESPONSE", id: response.id }}
                    label="response"
                    author={response.author}
                  />
                ) : null}
              </div>
              <p className="text-body wrap-break-word whitespace-pre-line text-foreground">
                {response.body}
              </p>
              {request.isOwn && !response.isOwn ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-pressed={response.isHelpful}
                  className="self-start"
                  onClick={() => void toggleHelpful(response.id, !response.isHelpful)}
                >
                  <ThumbsUp aria-hidden className="size-4" />
                  {response.isHelpful ? "Marked helpful" : "This helped"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {request.canRespond ? (
          <form method="post" onSubmit={send} className="flex flex-col gap-2.5">
            <Label htmlFor={`${id}-reply`}>Offer help</Label>
            <Textarea
              id={`${id}-reply`}
              value={reply}
              rows={4}
              maxLength={HELP_RESPONSE_MAX}
              placeholder="Share what has worked for you…"
              onChange={(event) => setReply(event.target.value)}
            />
            <Button type="submit" disabled={isBusy || reply.trim() === ""} className="self-start">
              {isBusy ? "Sending…" : "Send"}
            </Button>
          </form>
        ) : replyNotice ? (
          <p className="text-body text-foreground-secondary">{replyNotice}</p>
        ) : null}
      </section>

      {isConfirmingDelete ? (
        <ConfirmDeleteDialog
          title="Delete this request?"
          description="Its replies and photos go with it. This can't be undone."
          confirmLabel="Delete request"
          isBusy={isDeleting}
          onConfirm={() => void remove()}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      ) : null}
    </div>
  );
}
