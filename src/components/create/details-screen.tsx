"use client";

import { ChevronRight, Clock, Hash, ListChecks, Shapes, Star } from "lucide-react";
import type { ReactNode } from "react";

import { PostCard } from "@/components/posts/post-card";
import { FieldError } from "@/components/ui/field-error";
import { Label, Textarea } from "@/components/ui/input";
import type { Media } from "@/lib/types/media";
import type { CreatorSummary, PostCard as PostCardData } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";
import { cn } from "@/lib/utils/cn";
import { formatMinutes, levelLabel } from "@/lib/utils/post-labels";

import {
  DifficultyTimeSheet,
  ExtrasSheet,
  POST_TYPES,
  SkillsSheet,
  TagsSheet,
  TypeSheet,
} from "./detail-sheets";
import { MediaPreview } from "./media-thumb";
import type { PostFields } from "./use-post-draft";
import type { UploadItem } from "./use-uploads";

// Details (F-17 step 4): Instagram's caption screen. The cover beside the title and story, then
// rows that open sheets. A dot marks what is still needed to share; from 1024px the feed card
// beside the rows updates as you type (UI_UX_GUIDELINES §8.1).

export type SheetName = "type" | "skills" | "tags" | "extras" | "time";

/** Title prompts ("My first …"), a different one per post. */
const TITLE_PROMPTS = [
  "My first crochet flower",
  "Halfway through my granny square blanket",
  "Watercolour leaves, round two",
  "A clay mug for my sister",
];

export type FieldProblems = Partial<
  Record<"title" | "skills" | "tags" | "extras" | "time" | "photos" | "ownWork", string>
>;

/** What still blocks Share, worked out here so the rows can show it before trying. */
export function missingForShare(
  fields: PostFields,
  items: UploadItem[],
  stepMedia: Map<string, Media>,
): FieldProblems {
  const problems: FieldProblems = {};
  if (fields.skillIds.length === 0) problems.skills = "Pick at least one craft.";
  if (items.some((item) => item.type === "IMAGE" && !item.altText.trim())) {
    problems.photos = "Describe every photo.";
  }
  if (fields.type === "TUTORIAL") {
    if (fields.steps.length < 2) problems.extras = "A tutorial needs at least two steps.";
    if (!fields.estimatedMinutes) problems.time = "Add roughly how long it takes.";
  }
  const undescribedStep = fields.steps.some(
    (step) => step.mediaId && !stepMedia.get(step.mediaId)?.altText?.trim(),
  );
  if (undescribedStep && !problems.extras) problems.extras = "Describe every step photo.";
  return problems;
}

function Row({
  icon,
  label,
  value,
  problem,
  needed,
  onOpen,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  problem?: string;
  /** Still needed to share (a dot), without an error yet. */
  needed?: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex min-h-16 w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition hover:bg-muted",
          problem && "bg-destructive-surface hover:bg-destructive-surface",
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 text-control-lg font-bold text-foreground">
            {label}
            {needed && !problem ? (
              <span className="size-2 rounded-full bg-primary" aria-label="needed to share" />
            ) : null}
          </span>
          {problem ? (
            <span className="text-meta text-destructive">{problem}</span>
          ) : (
            <span className="truncate text-meta text-foreground-secondary">{value ?? "Add"}</span>
          )}
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

export function DetailsScreen({
  fields,
  onChange,
  items,
  skills,
  onSkillAdded,
  canAddOwnSkill,
  creator,
  postId,
  problems,
  showNeeded,
  openSheet,
  onOpenSheet,
  footer,
  stepMedia,
  onStepMedia,
}: {
  /** Photos of the steps, by media id. */
  stepMedia: Map<string, Media>;
  onStepMedia: (media: Media) => void;
  fields: PostFields;
  onChange: (change: Partial<PostFields>) => void;
  items: UploadItem[];
  skills: SkillSummary[];
  onSkillAdded: (skill: SkillSummary) => void;
  canAddOwnSkill: boolean;
  creator: CreatorSummary | null;
  postId: string | null;
  problems: FieldProblems;
  /** Dots on rows still needed to share. */
  showNeeded: FieldProblems;
  openSheet: SheetName | null;
  onOpenSheet: (sheet: SheetName | null) => void;
  /** Own-work confirmation, Share / Save and Delete. */
  footer: ReactNode;
}) {
  // From the post id, so the server and the browser render the same prompt.
  const seed = [...(postId ?? "")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const prompt = TITLE_PROMPTS[seed % TITLE_PROMPTS.length] ?? "";
  const cover = items[0];
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const chosen = fields.skillIds.flatMap((id) => byId.get(id) ?? []);
  const main = chosen.find((skill) => skill.id === fields.primarySkillId) ?? chosen[0];
  const type = POST_TYPES.find((option) => option.type === fields.type);
  const TypeIcon = type?.icon ?? Shapes;
  const isTutorial = fields.type === "TUTORIAL";
  const sheet = (name: SheetName) => ({
    open: openSheet === name,
    onOpenChange: (open: boolean) => onOpenSheet(open ? name : null),
  });

  const preview: PostCardData | null = cover?.media
    ? {
        id: postId ?? "preview",
        type: fields.type,
        title: fields.title.trim() || "Your title",
        estimatedMinutes: fields.estimatedMinutes,
        coverMedia: cover.media,
        mediaCount: items.length,
        skills: chosen,
        primarySkillId: main?.id ?? "",
        creator,
        attribution: null,
        isSaved: false,
      }
    : null;

  const timeValue = [
    fields.difficulty ? levelLabel(fields.difficulty) : null,
    fields.estimatedMinutes ? formatMinutes(fields.estimatedMinutes) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const extrasValue = [
    fields.materials.length > 0 ? `${fields.materials.length} materials` : null,
    fields.steps.length > 0 ? `${fields.steps.length} steps` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex gap-4">
          {cover ? (
            <div className="relative size-20 shrink-0 overflow-hidden rounded-md md:size-24">
              <MediaPreview item={cover} className="size-full" />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="post-title" className="sr-only">
              Title
            </Label>
            <Textarea
              id="post-title"
              rows={2}
              maxLength={120}
              placeholder={prompt}
              value={fields.title}
              aria-invalid={problems.title ? true : undefined}
              aria-describedby={problems.title ? "post-title-error" : undefined}
              onChange={(event) => onChange({ title: event.target.value.replace(/\n/g, " ") })}
              className="min-h-0 resize-none border-0 bg-transparent p-0 text-greeting text-foreground shadow-none placeholder:text-muted-foreground focus-visible:outline-offset-4 md:text-greeting-web"
            />
            <FieldError id="post-title-error">{problems.title}</FieldError>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-story">The story</Label>
          <Textarea
            id="post-story"
            rows={4}
            maxLength={2_000}
            placeholder="What did you make? What went well, what would you change?"
            value={fields.description ?? ""}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </div>

        <ul className="flex flex-col divide-y divide-border-faint border-y border-border-faint">
          <Row
            icon={<TypeIcon aria-hidden className="size-5" />}
            label="Type"
            value={type?.label ?? null}
            onOpen={() => onOpenSheet("type")}
          />
          <Row
            icon={<Star aria-hidden className="size-5" />}
            label="Crafts"
            value={chosen.length > 0 ? chosen.map((skill) => skill.name).join(", ") : null}
            problem={problems.skills}
            needed={Boolean(showNeeded.skills)}
            onOpen={() => onOpenSheet("skills")}
          />
          <Row
            icon={<Hash aria-hidden className="size-5" />}
            label="Tags"
            value={fields.tags.length > 0 ? fields.tags.map((tag) => `#${tag}`).join(" ") : null}
            problem={problems.tags}
            onOpen={() => onOpenSheet("tags")}
          />
          <Row
            icon={<ListChecks aria-hidden className="size-5" />}
            label={isTutorial ? "Materials and steps" : "Materials and steps (optional)"}
            value={extrasValue || null}
            problem={problems.extras}
            needed={Boolean(showNeeded.extras)}
            onOpen={() => onOpenSheet("extras")}
          />
          <Row
            icon={<Clock aria-hidden className="size-5" />}
            label={isTutorial ? "Difficulty and time" : "Difficulty and time (optional)"}
            value={timeValue || null}
            problem={problems.time}
            needed={Boolean(showNeeded.time)}
            onOpen={() => onOpenSheet("time")}
          />
        </ul>

        {footer}
      </div>

      <aside className="hidden lg:block" aria-label="Preview">
        <div className="sticky top-24 flex flex-col gap-3">
          <p className="flex items-center gap-2 text-overline text-foreground-secondary uppercase">
            <Shapes aria-hidden className="size-4" />
            How it looks in the feed
          </p>
          {preview ? (
            // A picture of the card only: inert and hidden from assistive tech (the fields say it all).
            <div inert aria-hidden className="w-64 animate-dd-up">
              <PostCard post={preview} isSignedIn={false} />
            </div>
          ) : (
            <p className="text-body text-muted-foreground">
              Your card shows here once the cover has uploaded.
            </p>
          )}
        </div>
      </aside>

      <TypeSheet
        {...sheet("type")}
        value={fields.type}
        onChange={(next) => onChange({ type: next })}
      />
      <SkillsSheet
        {...sheet("skills")}
        skills={skills}
        skillIds={fields.skillIds}
        primarySkillId={fields.primarySkillId}
        canAddOwn={canAddOwnSkill}
        onChange={(change, added) => {
          if (added && !byId.has(added.id)) onSkillAdded(added);
          onChange(change);
        }}
      />
      <TagsSheet
        {...sheet("tags")}
        tags={fields.tags}
        error={problems.tags}
        onChange={(tags) => onChange({ tags })}
      />
      <ExtrasSheet
        {...sheet("extras")}
        materials={fields.materials}
        steps={fields.steps}
        isTutorial={isTutorial}
        error={problems.extras}
        stepMedia={stepMedia}
        onStepMedia={onStepMedia}
        onChange={onChange}
      />
      <DifficultyTimeSheet
        {...sheet("time")}
        difficulty={fields.difficulty}
        estimatedMinutes={fields.estimatedMinutes}
        isTutorial={isTutorial}
        error={problems.time}
        onChange={onChange}
      />
    </div>
  );
}
