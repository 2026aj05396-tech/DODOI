"use client";

import { Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { showToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { deleteOwnPost } from "@/lib/api-client/own-posts";
import { ApiRequestError } from "@/lib/api-client/request";
import type { CreatorSummary, OwnPost, OwnPostSummary } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";

import { ArrangeScreen } from "./arrange-screen";
import { Celebration } from "./celebration";
import { CreateHeader } from "./create-header";
import {
  DetailsScreen,
  missingForShare,
  type FieldProblems,
  type SheetName,
} from "./details-screen";
import { PhotoEditor } from "./photo-editor";
import { PickScreen } from "./pick-screen";
import { usePostDraft, type SaveState } from "./use-post-draft";
import { useUploads } from "./use-uploads";

// Create post, Instagram-style (P2-02; USER_FLOWS F-17, UI_UX_GUIDELINES §8.1): Pick → Arrange →
// Details → Post. Uploads start on pick, a draft saves itself, and posting ends in one short
// celebration. A published post opens on Details and saves with "Save" instead.

type Screen = "pick" | "arrange" | "details";

const SCREEN_TITLES: Record<Screen, string> = {
  pick: "New post",
  arrange: "Arrange",
  details: "Details",
};

/** Server field names (API_SPECIFICATION §9.1) → the row or screen that fixes them. */
const FIELD_TO_PROBLEM: Record<string, keyof FieldProblems> = {
  title: "title",
  skillIds: "skills",
  primarySkillId: "skills",
  tags: "tags",
  steps: "extras",
  materials: "extras",
  estimatedMinutes: "time",
  difficulty: "time",
  mediaIds: "photos",
  ownWorkConfirmed: "ownWork",
};

const PROBLEM_TO_SHEET: Partial<Record<keyof FieldProblems, SheetName>> = {
  skills: "skills",
  tags: "tags",
  extras: "extras",
  time: "time",
};

function toProblems(fields: Record<string, string>): FieldProblems {
  const problems: FieldProblems = {};
  for (const [field, message] of Object.entries(fields)) {
    const key = FIELD_TO_PROBLEM[field];
    if (key && !problems[key]) problems[key] = message;
  }
  return problems;
}

function statusText(state: SaveState, isPublished: boolean, isDirty: boolean): string | undefined {
  if (isPublished) return isDirty ? "Unsaved changes" : undefined;
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved as draft";
  if (state === "failed") return "Not saved yet · we'll try again";
  return undefined;
}

export function CreatePostFlow({
  post: initialPost,
  skills: initialSkills,
  creator,
  drafts,
  canAddOwnSkill,
}: {
  post: OwnPost | null;
  skills: SkillSummary[];
  creator: CreatorSummary | null;
  drafts: OwnPostSummary[];
  canAddOwnSkill: boolean;
}) {
  const router = useRouter();
  const uploads = useUploads(initialPost?.media ?? []);
  const doneIds = uploads.items.flatMap((item) => (item.media ? [item.media.id] : []));
  const draft = usePostDraft(initialPost, doneIds);
  const [screen, setScreen] = useState<Screen>(initialPost ? "details" : "pick");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [openSheet, setOpenSheet] = useState<SheetName | null>(null);
  const [problems, setProblems] = useState<FieldProblems>({});
  const [skills, setSkills] = useState(initialSkills);
  const [ownWork, setOwnWork] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shared, setShared] = useState<OwnPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [stepMedia, setStepMedia] = useState(
    () =>
      new Map(
        (initialPost?.steps ?? []).flatMap((step) =>
          step.media ? [[step.media.id, step.media] as const] : [],
        ),
      ),
  );
  const editing = uploads.items.find((item) => item.key === editingKey) ?? null;

  useUnsavedChanges(draft.isDirty);

  const isPublished = draft.isPublished;
  const isUploading = uploads.items.some((item) => item.status === "uploading");
  const hasFailed = uploads.items.some((item) => item.status === "failed");
  const needsOwnWork = !draft.post?.ownWorkConfirmed && !isPublished;
  const needed = missingForShare(draft.fields, uploads.items, stepMedia);

  function change(update: Parameters<typeof draft.change>[0]) {
    draft.change(update);
    // Fixing something clears its message.
    setProblems((current) => {
      const next = { ...current };
      if ("title" in update) delete next.title;
      if ("skillIds" in update) delete next.skills;
      if ("tags" in update) delete next.tags;
      if ("steps" in update || "materials" in update) delete next.extras;
      if ("estimatedMinutes" in update || "difficulty" in update) delete next.time;
      return next;
    });
  }

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    const added = uploads.add(files);
    if (added < files.length) {
      showToast({ message: "A post can have up to 10 photos or videos." });
    }
  }

  function close() {
    if (isUploading && !window.confirm("Some uploads haven't finished. Leave anyway?")) return;
    if (window.history.length > 1) router.back();
    else router.push("/feed");
  }

  function back() {
    if (screen === "details" && !isPublished) setScreen("arrange");
    else if (screen === "arrange") setScreen("pick");
    else close();
  }

  /** Shows what blocks sharing: the row's message, and the screen or sheet that fixes it. */
  function showProblems(found: FieldProblems) {
    setProblems(found);
    if (found.ownWork && Object.keys(found).length === 1) {
      // Below the fold on phones: bring the tick box to the maker.
      const box = document.getElementById("own-work");
      box?.scrollIntoView({ behavior: "smooth", block: "center" });
      box?.focus({ preventScroll: true });
      return;
    }
    if (found.photos) {
      setScreen("arrange");
      return;
    }
    setScreen("details");
    const first = (Object.keys(found) as (keyof FieldProblems)[]).find(
      (key) => PROBLEM_TO_SHEET[key],
    );
    if (first) setOpenSheet(PROBLEM_TO_SHEET[first] ?? null);
  }

  async function share() {
    if (isUploading) {
      showToast({ message: "Hang on, your photos are still uploading." });
      return;
    }
    const found: FieldProblems = { ...needed };
    if (needsOwnWork && !ownWork) found.ownWork = "Tick this to post it.";
    if (Object.keys(found).length > 0) {
      showProblems(found);
      return;
    }
    setIsSharing(true);
    try {
      setShared(await draft.share(ownWork));
    } catch (error) {
      if (error instanceof ApiRequestError && Object.keys(error.fields).length > 0) {
        showProblems(toProblems(error.fields));
      } else {
        showToast({
          message:
            error instanceof ApiRequestError ? error.message : "We couldn't post it. Try again.",
        });
      }
    } finally {
      setIsSharing(false);
    }
  }

  async function save() {
    try {
      await draft.saveNow();
      showToast({ message: "Saved" });
      router.push(`/p/${draft.post?.id ?? ""}`);
    } catch (error) {
      if (error instanceof ApiRequestError && Object.keys(error.fields).length > 0) {
        showProblems(toProblems(error.fields));
      } else {
        showToast({
          message:
            error instanceof ApiRequestError ? error.message : "We couldn't save. Try again.",
        });
      }
    }
  }

  async function remove() {
    const id = draft.post?.id;
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteOwnPost(id);
      showToast({ message: isPublished ? "Post deleted" : "Draft deleted" });
      router.push(creator ? `/u/${creator.username}` : "/feed");
    } catch (error) {
      setIsDeleting(false);
      showToast({
        message: error instanceof ApiRequestError ? error.message : "We couldn't delete it.",
      });
    }
  }

  let action: { label: string; onClick: () => void; disabled?: boolean };
  if (screen === "pick") {
    action = {
      label: "Next",
      onClick: () => setScreen("arrange"),
      disabled: uploads.items.length === 0,
    };
  } else if (screen === "arrange") {
    action = { label: "Next", onClick: () => setScreen("details") };
  } else if (isPublished) {
    action = { label: "Save", onClick: () => void save(), disabled: !draft.isDirty };
  } else {
    action = {
      // "Post", not "Share": sharing means sending a link (PO decision 2026-10-29).
      label: isSharing ? "Posting…" : "Post",
      onClick: () => void share(),
      disabled: isSharing,
    };
  }

  const footer = (
    <div className="flex flex-col gap-4 md:pb-6">
      {needsOwnWork ? (
        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-start gap-3 rounded-card bg-butter/50 p-3.5 text-body text-foreground">
            <input
              id="own-work"
              type="checkbox"
              checked={ownWork}
              aria-describedby={problems.ownWork ? "own-work-error" : undefined}
              onChange={(event) => {
                setOwnWork(event.target.checked);
                setProblems(({ ownWork: _cleared, ...rest }) => rest);
              }}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              This is my own work, and I&apos;m happy for dodoi to show it. You keep ownership, and
              deleting the post takes it down.
            </span>
          </label>
          <FieldError id="own-work-error">{problems.ownWork}</FieldError>
        </div>
      ) : null}
      <FieldError id="uploads-error">
        {hasFailed ? "Some uploads didn't work. Go back to Photos to try them again." : null}
      </FieldError>
      <div className="hidden md:block">
        <Button size="lg" className="w-full" onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {draft.post ? (
          <Link
            href={`/p/${draft.post.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-control font-bold text-link hover:underline"
          >
            <Eye aria-hidden className="size-4.5" />
            Preview
          </Link>
        ) : (
          <span />
        )}
        {draft.post ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="text" className="text-destructive">
                <Trash2 aria-hidden className="size-4.5" />
                {isPublished ? "Delete post" : "Delete draft"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>{isPublished ? "Delete this post?" : "Delete this draft?"}</DialogTitle>
              <DialogDescription>
                {isPublished
                  ? "Comments, likes and saves go with it. This can't be undone."
                  : "Its photos and text are deleted. This can't be undone."}
              </DialogDescription>
              <div className="flex justify-end gap-2.5">
                <DialogClose asChild>
                  <Button variant="outline">Keep it</Button>
                </DialogClose>
                <Button variant="destructive" onClick={() => void remove()} disabled={isDeleting}>
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper">
      <CreateHeader
        title={isPublished && screen === "details" ? "Edit post" : SCREEN_TITLES[screen]}
        backLabel={screen === "pick" || (screen === "details" && isPublished) ? "Close" : "Back"}
        onBack={back}
        status={
          screen === "pick" ? undefined : statusText(draft.saveState, isPublished, draft.isDirty)
        }
        action={
          // Nothing to move on with yet: the drop area is the only thing to do.
          screen === "pick" && uploads.items.length === 0 ? null : (
            <Button
              variant="text"
              className="px-3 text-control-lg disabled:bg-transparent disabled:text-muted-foreground"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </Button>
          )
        }
      />

      <main id="main-content" className="pb-28 md:pb-0">
        {screen === "pick" ? (
          <PickScreen
            items={uploads.items}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            onAdd={addFiles}
            onRemove={uploads.remove}
            onRetry={uploads.retry}
            onEdit={setEditingKey}
            drafts={drafts}
          />
        ) : null}
        {screen === "arrange" ? (
          <ArrangeScreen
            items={uploads.items}
            error={problems.photos ?? null}
            onMove={uploads.move}
            onMoveTo={uploads.moveTo}
            onAltTextChange={(key, text) => {
              uploads.setAltText(key, text);
              setProblems(({ photos: _cleared, ...rest }) => rest);
            }}
            onEdit={setEditingKey}
            onAltTextBlur={(key) => {
              uploads
                .saveAltText(key)
                .catch(() =>
                  showToast({ message: "We couldn't save that description. Try again." }),
                );
            }}
          />
        ) : null}
        {screen === "details" ? (
          <DetailsScreen
            fields={draft.fields}
            onChange={change}
            items={uploads.items}
            skills={skills}
            onSkillAdded={(skill) => setSkills((current) => [...current, skill])}
            canAddOwnSkill={canAddOwnSkill}
            creator={creator}
            postId={draft.post?.id ?? null}
            problems={problems}
            showNeeded={needed}
            openSheet={openSheet}
            onOpenSheet={setOpenSheet}
            footer={footer}
            stepMedia={stepMedia}
            onStepMedia={(media) =>
              setStepMedia((current) => new Map(current).set(media.id, media))
            }
          />
        ) : null}
      </main>

      {/* Phones: the next action in thumb reach as well (UI_UX_GUIDELINES §8.1). */}
      {screen !== "pick" || uploads.items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-faint bg-background/95 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <Button size="lg" className="w-full" onClick={action.onClick} disabled={action.disabled}>
            {action.label}
          </Button>
        </div>
      ) : null}

      {editing ? (
        <PhotoEditor
          key={editing.key}
          open
          onOpenChange={(open) => {
            if (!open) setEditingKey(null);
          }}
          src={editing.localUrl ?? editing.media?.url ?? null}
          name={`photo-${uploads.items.indexOf(editing) + 1}`}
          onApply={(file) => uploads.replace(editing.key, file, editing.altText)}
        />
      ) : null}

      {shared ? <Celebration postId={shared.id} title={shared.title} /> : null}
    </div>
  );
}
