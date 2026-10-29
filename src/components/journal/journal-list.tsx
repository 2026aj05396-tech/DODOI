"use client";

import { NotebookPen, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label } from "@/components/ui/input";
import { createProject } from "@/lib/api-client/journal";
import { ApiRequestError } from "@/lib/api-client/request";
import type { ProjectSummary } from "@/lib/types/journal";
import type { SkillSummary } from "@/lib/types/skills";

import { ProjectCard } from "./project-card";

// The journal (P2-03, F-18 step 1): projects in progress first, then finished ones, and
// "New project" (a name and, optionally, one of the maker's crafts).

export function JournalList({
  projects,
  skills,
}: {
  projects: ProjectSummary[];
  /** The maker's interests, offered as the project's craft. */
  skills: SkillSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inProgress = projects.filter((project) => project.status === "IN_PROGRESS");
  const finished = projects.filter((project) => project.status === "COMPLETED");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Give your project a name.");
      return;
    }
    setIsSaving(true);
    try {
      const project = await createProject({ title: title.trim(), skillId });
      router.push(`/projects/${project.id}`);
    } catch (failure) {
      setIsSaving(false);
      setError(failure instanceof ApiRequestError ? failure.message : "We couldn't create it.");
    }
  }

  const newButton = (
    <Button onClick={() => setOpen(true)}>
      <Plus aria-hidden className="size-4.5" />
      New project
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-body text-foreground-secondary">
          Keep track of what you&apos;re making: a photo and a line each time you work on it.
        </p>
        {projects.length > 0 ? newButton : null}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<NotebookPen />}
          title="Start your first project"
          titleAs="h2"
          description="Name it, then add progress as you go. Only you see it unless you share it."
          action={newButton}
        />
      ) : null}

      {[
        { label: "In progress", items: inProgress },
        { label: "Finished", items: finished },
      ].map((group) =>
        group.items.length > 0 ? (
          <section key={group.label} className="flex flex-col gap-4">
            <h2 className="text-section text-foreground">{group.label}</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 xl:grid-cols-4">
              {group.items.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} />
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent layout="sheet">
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Only you see it unless you choose to show it.</DialogDescription>
          <form method="post" onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-project-title">Name</Label>
              <Input
                id="new-project-title"
                value={title}
                maxLength={80}
                placeholder="e.g. My first embroidered flower"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            {skills.length > 0 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-control font-bold text-foreground">
                  Craft (optional)
                </legend>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <ToggleChip
                      key={skill.id}
                      variant="interest"
                      pressed={skillId === skill.id}
                      onPressedChange={(on) => setSkillId(on ? skill.id : null)}
                    >
                      {skill.name}
                    </ToggleChip>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {error ? <ErrorBanner>{error}</ErrorBanner> : null}
            <Button type="submit" size="lg" disabled={isSaving}>
              {isSaving ? "Creating…" : "Create project"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
