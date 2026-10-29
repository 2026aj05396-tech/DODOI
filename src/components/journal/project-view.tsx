"use client";

import {
  BadgeCheck,
  Globe,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { checkMaterial, deleteEntry, deleteProject, updateProject } from "@/lib/api-client/journal";
import { createOwnPost } from "@/lib/api-client/own-posts";
import { ApiRequestError } from "@/lib/api-client/request";
import type { Project, ProjectEntry } from "@/lib/types/journal";
import { cn } from "@/lib/utils/cn";
import { relativeDay } from "@/lib/utils/relative-day";

import { EntrySheet } from "./entry-sheet";

// A project in the creative journal (P2-03, design `1g`; USER_FLOWS F-18): the status label,
// title and "skill · started … · n entries", the materials checklist from its tutorial, and the
// entries as a timeline, newest first. The owner adds entries, shares, and manages the project.

const MENU_ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-control text-foreground outline-none data-highlighted:bg-muted";

function message(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

function EntryPhotos({ entry }: { entry: ProjectEntry }) {
  const [first, ...rest] = entry.media;
  if (!first) return null;
  if (rest.length === 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image
      <img
        src={first.url}
        srcSet={first.srcSet}
        sizes="(min-width: 768px) 36rem, 100vw"
        alt={first.altText ?? ""}
        className="max-h-96 w-full rounded-md object-cover"
      />
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-2">
      {entry.media.map((media) => (
        <li key={media.id}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image */}
          <img
            src={media.url}
            srcSet={media.srcSet}
            sizes="(min-width: 768px) 18rem, 50vw"
            alt={media.altText ?? ""}
            className="aspect-[4/3] w-full rounded-md object-cover"
          />
        </li>
      ))}
    </ul>
  );
}

export function ProjectView({ project: initial }: { project: Project }) {
  const router = useRouter();
  const [project, setProject] = useState(initial);
  const [entrySheet, setEntrySheet] = useState<{ entry: ProjectEntry | null } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [confirmDelete, setConfirmDelete] = useState<"project" | ProjectEntry | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const isDone = project.status === "COMPLETED";
  const latest = project.entries[0];

  async function change(input: Parameters<typeof updateProject>[1], done?: string) {
    try {
      setProject(await updateProject(project.id, input));
      if (done) showToast({ message: done });
    } catch (error) {
      showToast({ message: message(error, "We couldn't change that. Try again.") });
    }
  }

  async function toggleMaterial(materialId: string, checked: boolean) {
    const before = project;
    setProject({
      ...project,
      materials: project.materials.map((material) =>
        material.id === materialId ? { ...material, checked } : material,
      ),
    });
    try {
      await checkMaterial(project.id, materialId, checked);
    } catch {
      setProject(before);
      showToast({ message: "We couldn't save that tick. Try again." });
    }
  }

  /** "Share" (JRN-05): a draft post from the latest entry, opened in Create on Details. */
  async function share() {
    setIsSharing(true);
    try {
      const draft = await createOwnPost({
        type: isDone ? "FINISHED" : "WORK_IN_PROGRESS",
        title: project.title,
        description: latest?.body ?? null,
        skillIds: project.skill ? [project.skill.id] : [],
        primarySkillId: project.skill?.id ?? null,
        mediaIds: latest?.media.map((media) => media.id) ?? [],
        projectId: project.id,
      });
      router.push(`/create/${draft.id}`);
    } catch (error) {
      setIsSharing(false);
      showToast({ message: message(error, "We couldn't start the post. Try again.") });
    }
  }

  async function remove() {
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      if (target === "project") {
        await deleteProject(project.id);
        showToast({ message: "Project deleted" });
        router.push("/journal");
        return;
      }
      if (target) {
        await deleteEntry(project.id, target.id);
        setProject({
          ...project,
          entries: project.entries.filter((entry) => entry.id !== target.id),
          entryCount: project.entryCount - 1,
        });
        showToast({ message: "Entry deleted" });
      }
    } catch (error) {
      showToast({ message: message(error, "We couldn't delete it. Try again.") });
    }
  }

  const actions = project.isOwner ? (
    <>
      <Button size="lg" className="flex-1" onClick={() => setEntrySheet({ entry: null })}>
        <Plus aria-hidden className="size-5" />
        Add progress entry
      </Button>
      <Button
        size="lg"
        variant="outline"
        onClick={() => void share()}
        disabled={isSharing || !latest}
        title={latest ? undefined : "Add an entry first"}
      >
        <Share2 aria-hidden className="size-4.5" />
        Share
      </Button>
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-6 pb-28 md:pb-10">
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-xs bg-muted px-2.5 py-1.5 text-overline text-foreground uppercase">
            Project · {isDone ? "finished" : "in progress"}
          </span>
          {project.isOwner ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                aria-label="Project options"
                className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted"
              >
                <MoreHorizontal aria-hidden className="size-5" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 min-w-56 rounded-md border border-border bg-background p-1 shadow-float"
                >
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setRenaming(true)}>
                    <Pencil aria-hidden className="size-4.5" />
                    Rename
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className={MENU_ITEM}
                    onSelect={() =>
                      void change(
                        { status: isDone ? "IN_PROGRESS" : "COMPLETED" },
                        isDone ? "Back in progress" : "Marked as finished. Well done!",
                      )
                    }
                  >
                    {isDone ? (
                      <RotateCcw aria-hidden className="size-4.5" />
                    ) : (
                      <BadgeCheck aria-hidden className="size-4.5" />
                    )}
                    {isDone ? "Reopen" : "Mark as finished"}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className={MENU_ITEM}
                    onSelect={() =>
                      void change(
                        { visibility: project.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC" },
                        project.visibility === "PUBLIC"
                          ? "Only you can see it now"
                          : "It shows on your profile now",
                      )
                    }
                  >
                    {project.visibility === "PUBLIC" ? (
                      <Lock aria-hidden className="size-4.5" />
                    ) : (
                      <Globe aria-hidden className="size-4.5" />
                    )}
                    {project.visibility === "PUBLIC" ? "Make private" : "Show on my profile"}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className={cn(MENU_ITEM, "text-destructive")}
                    onSelect={() => setConfirmDelete("project")}
                  >
                    <Trash2 aria-hidden className="size-4.5" />
                    Delete project
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
        <h1 className="text-title text-balance text-foreground md:text-title-web">
          {project.title}
        </h1>
        <p className="text-body text-foreground-secondary">
          {[
            project.skill?.name,
            `started ${relativeDay(project.createdAt)}`,
            `${project.entryCount} ${project.entryCount === 1 ? "entry" : "entries"}`,
          ]
            .filter(Boolean)
            .join(" · ")}
          {project.visibility === "PRIVATE" ? (
            <span className="ml-2 inline-flex items-center gap-1 align-middle text-meta">
              <Lock aria-hidden className="size-3.5" />
              Only you
            </span>
          ) : null}
        </p>
        {project.isOwner ? null : (
          <p className="text-body text-foreground-secondary">
            by{" "}
            <Link
              href={`/u/${project.owner.username}`}
              className="font-bold text-link hover:underline"
            >
              {project.owner.displayName}
            </Link>
          </p>
        )}
        {project.sourcePost ? (
          <p className="text-meta text-foreground-secondary">
            Started from{" "}
            <Link
              href={`/p/${project.sourcePost.id}`}
              className="font-bold text-link hover:underline"
            >
              {project.sourcePost.title}
            </Link>
          </p>
        ) : null}
      </header>

      {actions ? <div className="hidden gap-3 md:flex">{actions}</div> : null}

      {project.materials.length > 0 ? (
        <section aria-labelledby="project-materials" className="flex flex-col gap-2.5">
          <h2
            id="project-materials"
            className="flex items-baseline justify-between text-overline text-foreground-secondary uppercase"
          >
            Materials
            <span className="text-meta tracking-normal normal-case">
              {project.materials.filter((material) => material.checked).length} of{" "}
              {project.materials.length}
            </span>
          </h2>
          <ul className="divide-y divide-border-faint rounded-card border border-border">
            {project.materials.map((material) => (
              <li key={material.id}>
                <label className="flex min-h-11 items-center gap-3 px-3.5 py-2 text-body text-foreground">
                  <input
                    type="checkbox"
                    checked={material.checked}
                    disabled={!project.isOwner}
                    onChange={(event) => void toggleMaterial(material.id, event.target.checked)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className={cn(material.checked && "text-muted-foreground line-through")}>
                    {material.name}
                    {material.note ? (
                      <span className="text-foreground-secondary"> · {material.note}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Progress entries">
        {project.entries.length === 0 ? (
          <EmptyState
            title={project.isOwner ? "Your first entry goes here" : "No entries yet"}
            titleAs="h2"
            description={
              project.isOwner
                ? "A photo of where you're starting, or a list of what you'll need."
                : undefined
            }
          />
        ) : (
          <ol className="flex flex-col">
            {project.entries.map((entry, index) => {
              const isNewest = index === 0;
              const isLast = index === project.entries.length - 1;
              return (
                <li key={entry.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3.5">
                  <div aria-hidden className="flex flex-col items-center">
                    <span
                      className={cn(
                        "mt-1 size-3.5 shrink-0 rounded-full",
                        isNewest ? "bg-primary" : "border-2 border-link bg-background",
                      )}
                    />
                    {isLast ? null : <span className="w-0.5 flex-1 bg-pattern-lavender" />}
                  </div>
                  <article className="flex animate-dd-up flex-col gap-2 pb-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-meta text-foreground-secondary">
                          Entry {entry.number} · {relativeDay(entry.createdAt)}
                        </p>
                        {entry.title ? (
                          <h3 className="text-card-title-web text-foreground">{entry.title}</h3>
                        ) : null}
                      </div>
                      {project.isOwner ? (
                        <div className="flex shrink-0">
                          <button
                            type="button"
                            onClick={() => setEntrySheet({ entry })}
                            aria-label={`Edit entry ${entry.number}`}
                            className="flex size-9 items-center justify-center rounded-full text-foreground-secondary hover:bg-muted"
                          >
                            <Pencil aria-hidden className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(entry)}
                            aria-label={`Delete entry ${entry.number}`}
                            className="flex size-9 items-center justify-center rounded-full text-foreground-secondary hover:bg-muted"
                          >
                            <Trash2 aria-hidden className="size-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <EntryPhotos entry={entry} />
                    {entry.body ? (
                      <p className="text-body whitespace-pre-line text-foreground">{entry.body}</p>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {actions ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-muted bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
          {actions}
        </div>
      ) : null}

      {entrySheet ? (
        <EntrySheet
          key={entrySheet.entry?.id ?? "new"}
          open
          onOpenChange={(open) => {
            if (!open) setEntrySheet(null);
          }}
          projectId={project.id}
          entry={entrySheet.entry}
          nextNumber={(latest?.number ?? 0) + 1}
          onSaved={(saved) => {
            setProject(saved);
            showToast({ message: entrySheet.entry ? "Entry saved" : "Entry added" });
          }}
        />
      ) : null}

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogTitle>Rename project</DialogTitle>
          <form
            method="post"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setRenaming(false);
              void change({ title: title.trim() || project.title });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-title">Name</Label>
              <Input
                id="project-title"
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {confirmDelete === "project" ? "Delete this project?" : "Delete this entry?"}
          </DialogTitle>
          <DialogDescription>
            {confirmDelete === "project"
              ? "All its entries and photos go with it. Posts you shared from it stay."
              : "Its photos go with it. This can't be undone."}
          </DialogDescription>
          <div className="flex justify-end gap-2.5">
            <DialogClose asChild>
              <Button variant="outline">Keep it</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void remove()}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
