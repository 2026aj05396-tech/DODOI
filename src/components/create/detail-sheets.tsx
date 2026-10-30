"use client";

import {
  BadgeCheck,
  Hourglass,
  Lightbulb,
  ListOrdered,
  NotebookPen,
  Sparkles,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { SkillPicker } from "@/components/onboarding/skill-picker";
import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { PatternTile, type PatternAccent } from "@/components/ui/pattern-tile";
import { VoiceInputButton, VoiceInputStatus } from "@/components/ui/voice-input";
import { useVoiceTyping } from "@/hooks/use-voice-typing";
import type { ExperienceLevel } from "@/lib/schemas/me";
import { MAX_OWN_POST_ITEMS, MAX_OWN_POST_SKILLS, MAX_OWN_POST_TAGS } from "@/lib/schemas/posts";
import type { Media } from "@/lib/types/media";
import type { PostTypeName } from "@/lib/types/posts";
import type { SkillSummary } from "@/lib/types/skills";
import { cn } from "@/lib/utils/cn";
import { formatMinutes, levelLabel } from "@/lib/utils/post-labels";

import { StepPhoto } from "./step-photo";
import type { PostFields } from "./use-post-draft";

// The sheets behind the Details rows (F-17 step 4): bottom sheets on phones, centred panels from
// 768px (the shared `sheet` dialog). Each changes the post as you go; there is no Save inside.

type SheetProps = { open: boolean; onOpenChange: (open: boolean) => void };

function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: SheetProps & { title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent layout="sheet" className="md:max-w-lg">
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
        {children}
        <Button size="lg" className="mt-2 w-full" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export const POST_TYPES: {
  type: PostTypeName;
  label: string;
  meaning: string;
  icon: LucideIcon;
  accent: PatternAccent;
}[] = [
  {
    type: "FIRST_ATTEMPT",
    label: "First attempt",
    meaning: "You tried something new",
    icon: Sparkles,
    accent: "blush",
  },
  {
    type: "WORK_IN_PROGRESS",
    label: "Work in progress",
    meaning: "Halfway there, show the journey",
    icon: Hourglass,
    accent: "butter",
  },
  {
    type: "FINISHED",
    label: "Finished",
    meaning: "It's done, show it off",
    icon: BadgeCheck,
    accent: "mint",
  },
  {
    type: "TUTORIAL",
    label: "Tutorial",
    meaning: "Teach it step by step",
    icon: ListOrdered,
    accent: "lavender",
  },
  {
    type: "TIP",
    label: "Tip",
    meaning: "A trick that saves time or yarn",
    icon: Lightbulb,
    accent: "sky",
  },
  {
    type: "JOURNAL",
    label: "Journal",
    meaning: "Notes, sketches and thoughts",
    icon: NotebookPen,
    accent: "coral",
  },
];

export function TypeSheet({
  value,
  onChange,
  ...sheet
}: SheetProps & { value: PostTypeName; onChange: (type: PostTypeName) => void }) {
  return (
    <Sheet {...sheet} title="What kind of post is it?">
      <div role="radiogroup" aria-label="Post type" className="grid grid-cols-2 gap-2.5">
        {POST_TYPES.map((option) => {
          const Icon = option.icon;
          const checked = option.type === value;
          return (
            <button
              key={option.type}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(option.type)}
              className={cn(
                "relative flex min-h-28 flex-col items-start gap-1.5 overflow-hidden rounded-card border-2 p-3 text-left transition duration-150 active:scale-97",
                checked ? "border-selected-border shadow-hover" : "border-border hover:border-link",
              )}
            >
              <PatternTile
                accent={option.accent}
                className={cn(
                  "absolute inset-0 rounded-none",
                  checked ? "opacity-90" : "opacity-40",
                )}
              />
              <span className="relative flex size-9 items-center justify-center rounded-full bg-background">
                <Icon aria-hidden className="size-5 text-foreground" />
              </span>
              <span className="relative text-card-title text-foreground">{option.label}</span>
              <span className="relative text-meta text-foreground-secondary">{option.meaning}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export function SkillsSheet({
  skills,
  skillIds,
  primarySkillId,
  canAddOwn,
  onChange,
  ...sheet
}: SheetProps & {
  skills: SkillSummary[];
  skillIds: string[];
  primarySkillId: string | null;
  canAddOwn: boolean;
  onChange: (change: Pick<PostFields, "skillIds" | "primarySkillId">, added?: SkillSummary) => void;
}) {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const selected = skillIds.flatMap((id) => byId.get(id) ?? []);
  const isFull = skillIds.length >= MAX_OWN_POST_SKILLS;

  function toggle(skill: SkillSummary, on: boolean) {
    if (on) {
      if (isFull || skillIds.includes(skill.id)) return;
      onChange(
        { skillIds: [...skillIds, skill.id], primarySkillId: primarySkillId ?? skill.id },
        skill,
      );
      return;
    }
    const rest = skillIds.filter((id) => id !== skill.id);
    onChange({
      skillIds: rest,
      primarySkillId: primarySkillId === skill.id ? (rest[0] ?? null) : primarySkillId,
    });
  }

  return (
    <Sheet
      {...sheet}
      title="Which crafts?"
      description={`Pick up to ${MAX_OWN_POST_SKILLS}. Star the main one: it decides where the post shows first.`}
    >
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Chosen skills">
          {selected.map((skill) => {
            const isMain = skill.id === primarySkillId;
            return (
              <li key={skill.id}>
                <button
                  type="button"
                  aria-pressed={isMain}
                  onClick={() => onChange({ skillIds, primarySkillId: skill.id })}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border-control px-3.5 text-control transition",
                    isMain
                      ? "border-selected-border bg-primary font-bold text-primary-foreground"
                      : "border-input bg-background",
                  )}
                >
                  <Star aria-hidden className="size-4" fill={isMain ? "currentColor" : "none"} />
                  {skill.name}
                  <span className="sr-only">{isMain ? ", main skill" : ", make main skill"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <SkillPicker
        skills={skills}
        isSelected={(id) => skillIds.includes(id)}
        onToggle={toggle}
        canAddOwn={canAddOwn}
        searchLabel="Search crafts"
      />
      {isFull ? (
        <p className="text-meta text-foreground-secondary">
          That&apos;s {MAX_OWN_POST_SKILLS}. Remove one to pick another.
        </p>
      ) : null}
    </Sheet>
  );
}

/** A small "type and press Enter" list editor (tags, materials, steps). */
function AddField({
  id,
  label,
  placeholder,
  disabled,
  hasVoice = false,
  onAdd,
}: {
  id: string;
  label: string;
  placeholder: string;
  disabled?: boolean;
  /** Offers voice typing (steps, VOI-01). */
  hasVoice?: boolean;
  onAdd: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceTyping({ inputRef, value, onValueChange: setValue, disabled });
  function add() {
    const text = value.trim();
    if (!text) return;
    onAdd(text);
    setValue("");
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          enterKeyHint="done"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {hasVoice ? <VoiceInputButton voice={voice} disabled={disabled} /> : null}
        <Button variant="outline" onClick={add} disabled={disabled || !value.trim()}>
          Add
        </Button>
      </div>
      {hasVoice ? <VoiceInputStatus voice={voice} /> : null}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground-secondary hover:bg-muted hover:text-foreground"
    >
      <X aria-hidden className="size-4" />
    </button>
  );
}

export function TagsSheet({
  tags,
  error,
  onChange,
  ...sheet
}: SheetProps & { tags: string[]; error?: string; onChange: (tags: string[]) => void }) {
  return (
    <Sheet
      {...sheet}
      title="Tags"
      description="Words people might search for, like “air dry clay” or “gift idea”."
    >
      <AddField
        id="add-tag"
        label="Add a tag"
        placeholder="e.g. upcycled"
        disabled={tags.length >= MAX_OWN_POST_TAGS}
        onAdd={(tag) => {
          const name = tag.replace(/^#+/, "").trim().toLowerCase();
          if (name && !tags.includes(name)) onChange([...tags, name]);
        }}
      />
      {error ? <p className="text-meta text-destructive">{error}</p> : null}
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex h-9 animate-dd-pop items-center gap-1 rounded-full bg-lavender pr-1 pl-3.5 text-control-sm text-foreground"
            >
              #{tag}
              <RemoveButton
                label={`Remove tag ${tag}`}
                onClick={() => onChange(tags.filter((other) => other !== tag))}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-meta text-muted-foreground">
        {tags.length} of {MAX_OWN_POST_TAGS}
      </p>
    </Sheet>
  );
}

export function ExtrasSheet({
  materials,
  steps,
  isTutorial,
  error,
  stepMedia,
  onStepMedia,
  onChange,
  ...sheet
}: SheetProps & {
  materials: PostFields["materials"];
  steps: PostFields["steps"];
  isTutorial: boolean;
  error?: string;
  /** Photos of the steps, by media id (for thumbnails and descriptions). */
  stepMedia: Map<string, Media>;
  onStepMedia: (media: Media) => void;
  onChange: (change: Partial<Pick<PostFields, "materials" | "steps">>) => void;
}) {
  return (
    <Sheet
      {...sheet}
      title="Materials and steps"
      description={
        isTutorial
          ? "List what you used, then each step. A photo per step helps people follow along."
          : "Optional: what you used and how you made it."
      }
    >
      <section className="flex flex-col gap-3" aria-labelledby="materials-heading">
        <h3 id="materials-heading" className="text-overline text-foreground-secondary uppercase">
          Materials
        </h3>
        {materials.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {materials.map((material, index) => (
              <li
                key={`${material.name}-${index}`}
                className="flex animate-dd-pop items-center gap-2 rounded-md bg-muted py-1 pr-1 pl-3 text-body"
              >
                <span className="min-w-0 flex-1 truncate">{material.name}</span>
                <RemoveButton
                  label={`Remove ${material.name}`}
                  onClick={() => onChange({ materials: materials.filter((_, i) => i !== index) })}
                />
              </li>
            ))}
          </ul>
        ) : null}
        <AddField
          id="add-material"
          label="Add a material or tool"
          placeholder="e.g. 4 mm crochet hook"
          disabled={materials.length >= MAX_OWN_POST_ITEMS}
          onAdd={(name) => onChange({ materials: [...materials, { name, note: null }] })}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="steps-heading">
        <h3 id="steps-heading" className="text-overline text-foreground-secondary uppercase">
          Steps
        </h3>
        {error ? <p className="text-meta text-destructive">{error}</p> : null}
        {steps.length > 0 ? (
          <ol className="flex flex-col gap-1.5">
            {steps.map((step, index) => (
              <li
                key={`${step.text}-${index}`}
                className="flex animate-dd-pop items-start gap-2.5 rounded-md bg-muted py-1.5 pr-1 pl-2 text-body"
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-inverse text-badge text-inverse-foreground">
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5 pb-1">
                  <span>{step.text}</span>
                  <StepPhoto
                    stepNumber={index + 1}
                    media={step.mediaId ? (stepMedia.get(step.mediaId) ?? null) : null}
                    onChange={(media) => {
                      if (media) onStepMedia(media);
                      onChange({
                        steps: steps.map((other, i) =>
                          i === index ? { ...other, mediaId: media?.id ?? null } : other,
                        ),
                      });
                    }}
                  />
                </div>
                <RemoveButton
                  label={`Remove step ${index + 1}`}
                  onClick={() => onChange({ steps: steps.filter((_, i) => i !== index) })}
                />
              </li>
            ))}
          </ol>
        ) : null}
        <AddField
          id="add-step"
          hasVoice
          label={`Add step ${steps.length + 1}`}
          placeholder="e.g. Make a magic ring with 6 stitches"
          disabled={steps.length >= MAX_OWN_POST_ITEMS}
          onAdd={(text) => onChange({ steps: [...steps, { text, mediaId: null }] })}
        />
      </section>
    </Sheet>
  );
}

const LEVELS: ExperienceLevel[] = ["CURIOUS", "BEGINNER", "INTERMEDIATE", "EXPERIENCED"];
const QUICK_MINUTES = [15, 30, 60, 120, 240];

export function DifficultyTimeSheet({
  difficulty,
  estimatedMinutes,
  isTutorial,
  error,
  onChange,
  ...sheet
}: SheetProps & {
  difficulty: ExperienceLevel | null;
  estimatedMinutes: number | null;
  isTutorial: boolean;
  error?: string;
  onChange: (change: Partial<Pick<PostFields, "difficulty" | "estimatedMinutes">>) => void;
}) {
  return (
    <Sheet
      {...sheet}
      title="Difficulty and time"
      description={isTutorial ? "A tutorial needs roughly how long it takes." : "Both optional."}
    >
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-overline text-foreground-secondary uppercase">
          Who is it for?
        </legend>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((level) => (
            <ToggleChip
              key={level}
              variant="interest"
              pressed={difficulty === level}
              onPressedChange={(on) => onChange({ difficulty: on ? level : null })}
            >
              {levelLabel(level)}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-overline text-foreground-secondary uppercase">
          How long does it take?
        </legend>
        <div className="flex flex-wrap gap-2">
          {QUICK_MINUTES.map((minutes) => (
            <ToggleChip
              key={minutes}
              variant="interest"
              pressed={estimatedMinutes === minutes}
              onPressedChange={(on) => onChange({ estimatedMinutes: on ? minutes : null })}
            >
              {formatMinutes(minutes)}
            </ToggleChip>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="minutes" className="shrink-0">
            Or minutes
          </Label>
          <Input
            id="minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={10_000}
            className="w-28"
            value={estimatedMinutes ?? ""}
            onChange={(event) => {
              const minutes = Number.parseInt(event.target.value, 10);
              onChange({
                estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
              });
            }}
          />
        </div>
        {error ? <p className="text-meta text-destructive">{error}</p> : null}
      </fieldset>
    </Sheet>
  );
}
