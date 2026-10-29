import { Lock } from "lucide-react";
import Link from "next/link";

import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import type { ProjectSummary } from "@/lib/types/journal";
import { cn } from "@/lib/utils/cn";

// A project tile (journal list, profile Projects tab): the newest entry's photo, or the craft's
// pattern, with the status pill from design `1g`.

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const accent = (project.skill?.accent.toLowerCase() ?? "lavender") as PatternAccent;
  const isDone = project.status === "COMPLETED";
  return (
    <Link href={`/projects/${project.id}`} className="group flex flex-col gap-2 rounded-card">
      <span className="relative block aspect-[4/3] overflow-hidden rounded-card bg-muted">
        {project.coverMedia ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image
          <img
            src={project.coverMedia.posterUrl ?? project.coverMedia.url}
            alt=""
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <PatternTile accent={accent} className="size-full rounded-none" />
        )}
        <span
          className={cn(
            "absolute top-2 left-2 rounded-xs px-2 py-1 text-overline uppercase",
            isDone ? "bg-mint text-foreground" : "bg-background text-foreground",
          )}
        >
          {isDone ? "Finished" : "In progress"}
        </span>
        {project.visibility === "PRIVATE" ? (
          <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-background/90">
            <Lock aria-hidden className="size-3.5 text-foreground" />
            <span className="sr-only">Private</span>
          </span>
        ) : null}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-card-title text-foreground md:text-card-title-web">
          {project.title}
        </span>
        <span className="text-meta text-foreground-secondary">
          {[
            project.skill?.name,
            `${project.entryCount} ${project.entryCount === 1 ? "entry" : "entries"}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </Link>
  );
}
