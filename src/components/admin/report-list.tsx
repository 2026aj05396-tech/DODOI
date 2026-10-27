"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/components/ui/toast";
import { actOnReport, getReportGroups } from "@/lib/api-client/reports";
import { ApiRequestError } from "@/lib/api-client/request";
import type { ReportReason } from "@/lib/schemas/reports";
import type { ReportGroup } from "@/lib/types/reports";

import { StatusBadge } from "./status-badge";

// Admin reports (RPT-04, P1-28b; built from the system): one card per reported skill or profile
// with the number of reports, reasons and notes (never who reported). Open: Hide or Dismiss
// (resolves all its open reports); Resolved: Show again for hidden targets. Every action is
// audited on the server.

const REASON_LABELS: Record<ReportReason, string> = {
  OFFENSIVE: "Offensive",
  SPAM: "Spam",
  IMPERSONATION: "Impersonation",
  OTHER: "Other",
};

type Tab = "OPEN" | "RESOLVED";

function GroupCard({
  group,
  tab,
  onAct,
  isBusy,
}: {
  group: ReportGroup;
  tab: Tab;
  onAct: (action: "HIDE_TARGET" | "DISMISS" | "RESTORE_TARGET") => void;
  isBusy: boolean;
}) {
  const kind = group.targetType === "SKILL" ? "Skill" : "Profile";
  const label = group.target.label ?? "Deleted";
  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-meta font-bold text-foreground">
          {kind}
        </span>
        {group.target.href ? (
          <Link
            href={group.target.href}
            className="text-control-lg font-bold text-link hover:underline"
          >
            {label}
          </Link>
        ) : (
          <span className="text-control-lg font-bold text-foreground">{label}</span>
        )}
        {group.target.detail ? (
          <span className="text-meta text-foreground-secondary">{group.target.detail}</span>
        ) : null}
        {group.target.isHidden ? <StatusBadge status="HIDDEN" /> : null}
      </div>
      <p className="text-body text-foreground">
        {group.reportCount} {group.reportCount === 1 ? "report" : "reports"} ·{" "}
        {Object.entries(group.reasons)
          .map(([reason, count]) => `${REASON_LABELS[reason as ReportReason]} ${count}`)
          .join(", ")}
        <span className="text-foreground-secondary">
          {" "}
          · latest {new Date(group.latestAt).toLocaleDateString("en-IN")}
        </span>
      </p>
      {group.notes.length > 0 ? (
        <ul className="flex flex-col gap-1.5 rounded-md bg-field p-3">
          {group.notes.map((note, index) => (
            <li key={index} className="text-body text-foreground">
              <span className="font-bold">{REASON_LABELS[note.reason]}:</span> {note.note}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {tab === "OPEN" ? (
          <>
            {!group.target.isHidden && group.target.label ? (
              <Button size="sm" disabled={isBusy} onClick={() => onAct("HIDE_TARGET")}>
                Hide {kind.toLowerCase()}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onAct("DISMISS")}>
              Dismiss
            </Button>
          </>
        ) : group.target.isHidden ? (
          <Button
            size="sm"
            variant="outline"
            disabled={isBusy}
            onClick={() => onAct("RESTORE_TARGET")}
          >
            Show again
          </Button>
        ) : (
          <span className="text-meta text-foreground-secondary">
            {group.status === "DISMISSED" ? "Dismissed" : "Visible"}
          </span>
        )}
      </div>
    </li>
  );
}

export function ReportList() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("OPEN");
  const [busyId, setBusyId] = useState<string | null>(null);

  const groups = useInfiniteQuery({
    queryKey: ["admin-reports", tab],
    queryFn: ({ pageParam }) => getReportGroups(tab, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = groups.data?.pages.flatMap((page) => page.items) ?? [];

  async function act(group: ReportGroup, action: "HIDE_TARGET" | "DISMISS" | "RESTORE_TARGET") {
    setBusyId(group.reportId);
    try {
      await actOnReport(group.reportId, { action });
      showToast({
        message:
          action === "HIDE_TARGET"
            ? `${group.target.label} is hidden`
            : action === "DISMISS"
              ? "Reports dismissed"
              : `${group.target.label} is visible again`,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    } catch (error) {
      showToast({
        message: error instanceof ApiRequestError ? error.message : "That didn't work. Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-title text-foreground md:text-title-web">Reports</h1>
      <div role="group" aria-label="Show reports" className="flex gap-2">
        <ToggleChip pressed={tab === "OPEN"} onPressedChange={() => setTab("OPEN")}>
          Open
        </ToggleChip>
        <ToggleChip pressed={tab === "RESOLVED"} onPressedChange={() => setTab("RESOLVED")}>
          Resolved
        </ToggleChip>
      </div>
      {groups.isPending ? (
        <div role="status" aria-label="Loading reports" className="flex flex-col gap-3">
          <Skeleton className="h-36 w-full rounded-card" />
          <Skeleton className="h-36 w-full rounded-card" />
        </div>
      ) : groups.isError ? (
        <ErrorState message="We couldn't load reports." onRetry={() => void groups.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={tab === "OPEN" ? "No open reports" : "Nothing resolved yet"}
          titleAs="h2"
          description={tab === "OPEN" ? "New reports from makers show up here." : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((group) => (
            <GroupCard
              key={`${group.targetType}-${group.reportId}`}
              group={group}
              tab={tab}
              isBusy={busyId === group.reportId}
              onAct={(action) => void act(group, action)}
            />
          ))}
        </ul>
      )}
      {groups.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => void groups.fetchNextPage({ cancelRefetch: false })}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}
