"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getCommunityManageView, moderateCommunity } from "@/lib/api-client/communities";
import { ApiRequestError } from "@/lib/api-client/request";
import type { CommunityModerationInput } from "@/lib/schemas/communities";
import type { CommunityMemberView, CommunityRoleName } from "@/lib/types/communities";
import { timeAgo } from "@/lib/utils/time-ago";

// Manage sheet (COM-03, COM-04, COM-06, F-28 step 5). The owner and moderators see the member
// count, the members, removed members and a short audit list (who did what, never content). The
// owner appoints moderators, hands the community over and lets removed members back; moderators
// can remove members.

const LOG_TEXT: Record<string, string> = {
  "post.hide": "hid a post",
  "post.restore": "restored a post",
  "post.delete": "deleted a post",
  "member.remove": "removed a member",
  "member.allow": "let a removed member back",
  "role.change": "changed a role",
};

const ROLE_LABEL: Record<CommunityRoleName, string> = {
  OWNER: "Owner",
  MODERATOR: "Moderator",
  MEMBER: "Member",
};

export function CommunityManageDialog({
  slug,
  myRole,
  onClose,
  onChanged,
}: {
  slug: string;
  myRole: "OWNER" | "MODERATOR";
  onClose: () => void;
  /** Called after an action so the community page can refresh the viewer's role. */
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const isOwner = myRole === "OWNER";
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = useQuery({
    queryKey: ["community-manage", slug],
    queryFn: () => getCommunityManageView(slug),
    staleTime: 0,
  });

  async function act(member: CommunityMemberView, input: CommunityModerationInput) {
    setBusyId(member.userId);
    setError(null);
    try {
      await moderateCommunity(slug, input);
      await queryClient.invalidateQueries({ queryKey: ["community-manage", slug] });
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "We couldn't do that.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent layout="sheet" className="md:max-w-xl">
        <DialogTitle>Manage community</DialogTitle>
        <DialogDescription>
          {isOwner
            ? "Appoint moderators, hand the community over or let removed members back."
            : "You can remove members. Only the owner changes roles."}
        </DialogDescription>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        {view.isPending ? (
          <div role="status" aria-label="Loading" className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : view.isError ? (
          <ErrorState message="We couldn't load this." onRetry={() => void view.refetch()} />
        ) : (
          <div className="flex flex-col gap-6">
            <section aria-labelledby="manage-members" className="flex flex-col gap-2.5">
              <h3 id="manage-members" className="text-control-lg font-bold text-foreground">
                Members ({view.data.memberCount})
              </h3>
              <ul className="flex flex-col gap-2">
                {view.data.members.map((member) => {
                  const own = member.role === "OWNER";
                  const canRemove = !own && (isOwner || member.role === "MEMBER");
                  const isBusy = busyId === member.userId;
                  return (
                    <li
                      key={member.userId}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-control font-bold text-foreground">
                          {member.displayName}
                        </p>
                        <p className="truncate text-meta text-foreground-secondary">
                          @{member.username} · {ROLE_LABEL[member.role]}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isOwner && member.role === "MEMBER" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            aria-label={`Make ${member.displayName} a moderator`}
                            onClick={() =>
                              void act(member, {
                                action: "SET_ROLE",
                                targetId: member.userId,
                                role: "MODERATOR",
                              })
                            }
                          >
                            Make moderator
                          </Button>
                        ) : null}
                        {isOwner && member.role === "MODERATOR" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              aria-label={`Hand the community to ${member.displayName}`}
                              onClick={() =>
                                void act(member, {
                                  action: "SET_ROLE",
                                  targetId: member.userId,
                                  role: "OWNER",
                                })
                              }
                            >
                              Hand over
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              aria-label={`Make ${member.displayName} a regular member`}
                              onClick={() =>
                                void act(member, {
                                  action: "SET_ROLE",
                                  targetId: member.userId,
                                  role: "MEMBER",
                                })
                              }
                            >
                              Remove role
                            </Button>
                          </>
                        ) : null}
                        {canRemove ? (
                          <Button
                            size="sm"
                            variant="text"
                            className="text-destructive"
                            disabled={isBusy}
                            aria-label={`Remove ${member.displayName} from the community`}
                            onClick={() =>
                              void act(member, { action: "REMOVE_MEMBER", targetId: member.userId })
                            }
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {view.data.removed.length > 0 ? (
              <section aria-labelledby="manage-removed" className="flex flex-col gap-2.5">
                <h3 id="manage-removed" className="text-control-lg font-bold text-foreground">
                  Removed members
                </h3>
                <ul className="flex flex-col gap-2">
                  {view.data.removed.map((member) => (
                    <li
                      key={member.userId}
                      className="flex items-center gap-2 rounded-md border border-border p-3"
                    >
                      <p className="min-w-0 flex-1 truncate text-control text-foreground">
                        {member.displayName}{" "}
                        <span className="text-meta text-foreground-secondary">
                          @{member.username}
                        </span>
                      </p>
                      {isOwner ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === member.userId}
                          aria-label={`Let ${member.displayName} back in`}
                          onClick={() =>
                            void act(member, { action: "ALLOW_MEMBER", targetId: member.userId })
                          }
                        >
                          Let back in
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="manage-log" className="flex flex-col gap-2.5">
              <h3 id="manage-log" className="text-control-lg font-bold text-foreground">
                Recent activity
              </h3>
              {view.data.log.length === 0 ? (
                <p className="text-body text-foreground-secondary">Nothing yet.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {view.data.log.map((entry) => (
                    <li key={entry.id} className="text-body text-foreground">
                      <span className="font-bold">{entry.actor?.displayName ?? "Someone"}</span>{" "}
                      {LOG_TEXT[entry.action] ?? entry.action}{" "}
                      <span className="text-meta text-foreground-secondary">
                        · {timeAgo(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
