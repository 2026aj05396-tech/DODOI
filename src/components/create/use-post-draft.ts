"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createOwnPost, publishOwnPost, updateOwnPost } from "@/lib/api-client/own-posts";
import { ApiRequestError } from "@/lib/api-client/request";
import type { UpdateOwnPostInput } from "@/lib/schemas/posts";
import type { OwnPost } from "@/lib/types/posts";

// The post behind the Create flow (F-17). A draft is created with the first finished upload, and
// every change to a draft saves itself shortly after ("Saved as draft · just now"). A published
// post changes live, so its edits wait for "Save" (CRT-10).

export type PostFields = Required<
  Pick<
    UpdateOwnPostInput,
    | "type"
    | "title"
    | "description"
    | "skillIds"
    | "primarySkillId"
    | "tags"
    | "difficulty"
    | "estimatedMinutes"
    | "materials"
  >
> & { steps: { text: string; mediaId: string | null }[] };

export type SaveState = "idle" | "saving" | "saved" | "failed";

const AUTOSAVE_DELAY_MS = 700;

function fieldsOf(post: OwnPost | null): PostFields {
  return {
    type: post?.type ?? "FIRST_ATTEMPT",
    title: post?.title === "Untitled" ? "" : (post?.title ?? ""),
    description: post?.description ?? "",
    skillIds: post?.skillIds ?? [],
    primarySkillId: post?.primarySkillId ?? null,
    tags: post?.tags ?? [],
    difficulty: post?.difficulty ?? null,
    estimatedMinutes: post?.estimatedMinutes ?? null,
    materials: post?.materials ?? [],
    steps: post?.steps.map((step) => ({ text: step.text, mediaId: step.mediaId })) ?? [],
  };
}

/** What is sent for `fields`: an empty title stays "Untitled" until the maker writes one. */
function toInput(fields: Partial<PostFields>): UpdateOwnPostInput {
  const { title, description, ...rest } = fields;
  return {
    ...rest,
    ...(title !== undefined ? { title: title.trim() || "Untitled" } : {}),
    ...(description !== undefined ? { description: description?.trim() || null } : {}),
  };
}

export function usePostDraft(initial: OwnPost | null, mediaIds: string[]) {
  const [post, setPost] = useState<OwnPost | null>(initial);
  const [fields, setFields] = useState<PostFields>(() => fieldsOf(initial));
  const [saveState, setSaveState] = useState<SaveState>(initial ? "saved" : "idle");
  const isPublished = post?.status === "PUBLISHED";
  // A published post has unsaved changes when a field changed or the photos differ from what the
  // server last returned (worked out while rendering, not stored).
  const [fieldsChanged, setFieldsChanged] = useState(false);
  const mediaKey = mediaIds.join(",");
  const serverMediaKey = (post?.media ?? []).map((media) => media.id).join(",");
  const isDirty = isPublished && (fieldsChanged || mediaKey !== serverMediaKey);

  const postId = useRef<string | null>(initial?.id ?? null);
  const pending = useRef<UpdateOwnPostInput>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const savedMediaKey = useRef((initial?.media ?? []).map((media) => media.id).join(","));
  const creating = useRef(false);
  const lastError = useRef<unknown>(null);

  /** Runs saves one after another, so they reach the server in the order they were made. */
  const enqueue = useCallback(<T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task, task);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const flush = useCallback((): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const id = postId.current;
    const input = pending.current;
    if (!id || Object.keys(input).length === 0) return queue.current.then(() => undefined);
    pending.current = {};
    lastError.current = null;
    setSaveState("saving");
    return enqueue(() => updateOwnPost(id, input))
      .then((saved) => {
        setPost(saved);
        setSaveState("saved");
      })
      .catch((error: unknown) => {
        // Keep what failed so the next change (or Share) sends it again.
        pending.current = { ...input, ...pending.current };
        lastError.current = error;
        setSaveState("failed");
      });
  }, [enqueue]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }, [flush]);

  /** Changes fields; a draft saves them shortly after, a published post waits for Save. */
  const change = useCallback(
    (update: Partial<PostFields>) => {
      setFields((current) => ({ ...current, ...update }));
      pending.current = { ...pending.current, ...toInput(update) };
      if (isPublished) setFieldsChanged(true);
      else schedule();
    },
    [isPublished, schedule],
  );

  // The first finished upload creates the draft; later order changes save like other fields.
  useEffect(() => {
    if (mediaKey === savedMediaKey.current) return;
    if (!postId.current) {
      if (mediaIds.length === 0 || creating.current) return;
      creating.current = true;
      savedMediaKey.current = mediaKey;
      setSaveState("saving");
      void enqueue(() => createOwnPost({ ...toInput(fields), mediaIds }))
        .then((created) => {
          postId.current = created.id;
          setPost(created);
          setSaveState("saved");
          // The address becomes the draft's own, without reloading the screen.
          window.history.replaceState(null, "", `/create/${created.id}`);
          void flush();
        })
        .catch(() => {
          savedMediaKey.current = "";
          setSaveState("failed");
        })
        .finally(() => {
          creating.current = false;
        });
      return;
    }
    savedMediaKey.current = mediaKey;
    pending.current = { ...pending.current, mediaIds };
    if (!isPublished) schedule();
    // `fields` is read only when the draft is created; later changes save through `change`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaKey, enqueue, flush, schedule, isPublished]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** "Save" on a published post: sends every change at once (and fails as a whole). */
  const saveNow = useCallback(async () => {
    await flush();
    if (Object.keys(pending.current).length > 0) {
      throw lastError.current instanceof ApiRequestError
        ? lastError.current
        : new ApiRequestError(0, "NOT_SAVED", "We couldn't save your changes. Try again.");
    }
    setFieldsChanged(false);
  }, [flush]);

  /** "Share": saves what is waiting, then publishes. Throws ApiRequestError with field errors. */
  const share = useCallback(
    async (ownWorkConfirmed: boolean): Promise<OwnPost> => {
      await flush();
      const id = postId.current;
      if (!id) throw new Error("No draft yet");
      const published = await enqueue(() => publishOwnPost(id, { ownWorkConfirmed }));
      setPost(published);
      return published;
    },
    [enqueue, flush],
  );

  return { post, fields, change, saveState, isDirty, isPublished, flush, saveNow, share };
}
