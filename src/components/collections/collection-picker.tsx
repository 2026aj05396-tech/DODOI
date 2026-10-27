"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/components/ui/toast";
import {
  addToCollection,
  createCollection,
  getCollectionIdsForPost,
  getMyCollections,
  removeFromCollection,
} from "@/lib/api-client/collections";
import { ApiRequestError } from "@/lib/api-client/request";
import type { CollectionSummary } from "@/lib/types/collections";

import { setSaved } from "./saved-store";

// Collection picker (USER_FLOWS F-09; not designed, built from the system): a bottom sheet on
// mobile, a centred panel from 768px. Each collection is a checkbox; ticking adds the post (and
// saves it), unticking removes it from that collection only. "New collection" creates a private
// one with the post in it. Opened from anywhere with `openCollectionPicker()`; mounted once.

type Target = { postId: string; postTitle: string };

let target: Target | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setTarget(next: Target | null): void {
  target = next;
  for (const listener of listeners) listener();
}

export function openCollectionPicker(next: Target): void {
  setTarget(next);
}

export const COLLECTIONS_KEY = ["collections"] as const;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

function countLine(collection: CollectionSummary): string {
  const visibility = collection.visibility === "PUBLIC" ? "Public" : "Private";
  return `${collection.itemCount} saved · ${visibility}`;
}

function PickerBody({ postId, postTitle }: Target) {
  const queryClient = useQueryClient();
  const nameId = useId();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  // Ticks changed in this sheet, on top of what the server said.
  const [changes, setChanges] = useState(new Map<string, boolean>());

  const collections = useQuery({ queryKey: COLLECTIONS_KEY, queryFn: getMyCollections });
  const holding = useQuery({
    queryKey: ["post-collections", postId],
    queryFn: () => getCollectionIdsForPost(postId),
    staleTime: 0,
  });

  const toggle = useMutation({
    mutationFn: ({ id, add }: { id: string; add: boolean }) =>
      add ? addToCollection(id, postId) : removeFromCollection(id, postId),
    // One at a time, in the order ticked.
    scope: { id: `picker-${postId}` },
    onSuccess: (_result, { add }) => {
      if (add) setSaved(postId, true);
    },
    onError: (error, { id, add }) => {
      setChanges((current) => new Map(current).set(id, !add));
      showToast({ message: errorMessage(error, "We couldn't update that collection. Try again.") });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY }),
  });

  const create = useMutation({
    mutationFn: async (collectionName: string) => {
      const created = await createCollection(collectionName);
      await addToCollection(created.id, postId);
      return created;
    },
    onSuccess: (created) => {
      setSaved(postId, true);
      setChanges((current) => new Map(current).set(created.id, true));
      setName("");
      setIsCreating(false);
      void queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
    },
    onError: (error) => {
      setNameError(
        error instanceof ApiRequestError
          ? (error.fields.name ?? error.message)
          : "We couldn't create that collection. Try again.",
      );
    },
  });

  function isChecked(id: string): boolean {
    return changes.get(id) ?? holding.data?.includes(id) ?? false;
  }

  function onToggle(id: string) {
    const add = !isChecked(id);
    setChanges((current) => new Map(current).set(id, add));
    toggle.mutate({ id, add });
  }

  function onCreate(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Give the collection a name.");
      return;
    }
    setNameError(null);
    create.mutate(trimmed);
  }

  return (
    <>
      <DialogTitle>Save to collection</DialogTitle>
      <DialogDescription className="-mt-2 truncate">{postTitle}</DialogDescription>

      {collections.isPending || holding.isPending ? (
        <div role="status" aria-label="Loading your collections" className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ) : collections.isError || holding.isError ? (
        <p role="alert" className="text-body text-destructive">
          We couldn&apos;t load your collections.{" "}
          <Button
            variant="text"
            onClick={() => {
              void collections.refetch();
              void holding.refetch();
            }}
          >
            Try again
          </Button>
        </p>
      ) : collections.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
          {collections.data.map((collection) => {
            const checked = isChecked(collection.id);
            return (
              <li key={collection.id}>
                <label className="flex min-h-13 cursor-pointer items-center gap-3 px-4 py-2.5">
                  <span className="relative flex size-5 shrink-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(collection.id)}
                      className="size-5 cursor-pointer appearance-none rounded-xs border-control border-checkbox bg-background checked:border-selected-border checked:bg-primary"
                    />
                    {checked ? (
                      <Check
                        aria-hidden
                        className="pointer-events-none absolute inset-0 m-auto size-3.5 animate-dd-pop text-primary-foreground"
                        strokeWidth={3}
                      />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body font-bold text-foreground">
                      {collection.name}
                    </span>
                    <span className="text-meta text-foreground-secondary">
                      {countLine(collection)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-body text-foreground-secondary">
          No collections yet. Make one to group what you save.
        </p>
      )}

      {isCreating ? (
        <form onSubmit={onCreate} className="flex flex-col gap-2" noValidate>
          <Label htmlFor={nameId}>Collection name</Label>
          <Input
            id={nameId}
            value={name}
            maxLength={80}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
          />
          <FieldError id={`${nameId}-error`}>{nameError}</FieldError>
          <p className="text-meta text-foreground-secondary">
            New collections are private. You can make them public later.
          </p>
          <div className="flex gap-2.5">
            <Button type="submit" disabled={create.isPending}>
              Create and add
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setIsCreating(true)} className="self-start">
          <Plus aria-hidden className="size-4.5" />
          New collection
        </Button>
      )}

      <Button onClick={() => setTarget(null)}>Done</Button>
    </>
  );
}

/** Mounted once (root layout); shows the picker for the post passed to `openCollectionPicker`. */
export function CollectionPickerHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => target,
    () => null,
  );
  return (
    <Dialog
      open={current !== null}
      onOpenChange={(open) => {
        if (!open) setTarget(null);
      }}
    >
      <DialogContent layout="sheet">
        {current ? <PickerBody key={current.postId} {...current} /> : null}
      </DialogContent>
    </Dialog>
  );
}
