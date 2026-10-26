"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import {
  createAdminPost,
  deleteAdminPost,
  publishAdminPost,
  unpublishAdminPost,
  updateAdminPost,
} from "@/lib/api-client/admin";
import { updateMediaAltText } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import {
  MAX_POST_MEDIA,
  type AttributionInput,
  type CreateAdminPostInput,
} from "@/lib/schemas/admin";
import type { ExperienceLevel } from "@/lib/schemas/me";
import type { AdminPost } from "@/lib/types/admin";
import type { Media } from "@/lib/types/media";
import type { PostTypeName } from "@/lib/types/posts";

import { MediaField } from "./media-field";
import { SkillsField, type SkillOption } from "./skills-field";
import { StatusBadge } from "./status-badge";

const POST_TYPES: { value: PostTypeName; label: string }[] = [
  { value: "TUTORIAL", label: "Tutorial" },
  { value: "FIRST_ATTEMPT", label: "First attempt" },
  { value: "WORK_IN_PROGRESS", label: "Work in progress" },
  { value: "JOURNAL", label: "Journal" },
  { value: "FINISHED", label: "Finished" },
  { value: "TIP", label: "Tip" },
];

const LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: "CURIOUS", label: "Curious" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "EXPERIENCED", label: "Experienced" },
];

type SourceType = AttributionInput["sourceType"];

const SOURCES: { value: SourceType; label: string; hint: string }[] = [
  { value: "TEAM_ORIGINAL", label: "Team original", hint: "Made by the dodoi team." },
  {
    value: "INVITED_CREATOR",
    label: "Invited creator",
    hint: "Shown with the creator's dodoi account. Needs their written permission.",
  },
  { value: "STOCK_LICENSED", label: "Stock (licensed)", hint: "Needs the source link." },
  {
    value: "CREATIVE_COMMONS",
    label: "Creative Commons",
    hint: "CC BY or CC BY-SA only, with the original author and source link.",
  },
];

type Step = { key: string; text: string; media: Media | null };
type Material = { key: string; name: string; note: string };

type Draft = {
  type: PostTypeName;
  title: string;
  description: string;
  skillIds: string[];
  primarySkillId: string | null;
  media: Media[];
  difficulty: ExperienceLevel | "";
  estimatedMinutes: string;
  materials: Material[];
  steps: Step[];
  sourceType: SourceType | "";
  license: string;
  attributionText: string;
  originalAuthor: string;
  originalUrl: string;
  permissionRef: string;
  authorUsername: string;
};

let keySeed = 0;
const newKey = () => `item-${(keySeed += 1)}`;

function toDraft(post: AdminPost | null): Draft {
  return {
    type: post?.type ?? "TUTORIAL",
    title: post?.title ?? "",
    description: post?.description ?? "",
    skillIds: post?.skillIds ?? [],
    primarySkillId: post?.primarySkillId ?? null,
    media: post?.media ?? [],
    difficulty: post?.difficulty ?? "",
    estimatedMinutes: post?.estimatedMinutes ? String(post.estimatedMinutes) : "",
    materials: (post?.materials ?? []).map((item) => ({
      key: newKey(),
      name: item.name,
      note: item.note ?? "",
    })),
    steps: (post?.steps ?? []).map((step) => ({
      key: newKey(),
      text: step.text,
      media: step.media,
    })),
    sourceType: post?.attribution?.sourceType ?? "",
    license: post?.attribution?.license ?? "",
    attributionText: post?.attribution?.attributionText ?? "",
    originalAuthor: post?.attribution?.originalAuthor ?? "",
    originalUrl: post?.attribution?.originalUrl ?? "",
    permissionRef: post?.attribution?.permissionRef ?? "",
    authorUsername: post?.authorUsername ?? "",
  };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

function toPayload(draft: Draft): CreateAdminPostInput {
  return {
    type: draft.type,
    title: draft.title,
    description: orNull(draft.description),
    skillIds: draft.skillIds,
    primarySkillId: draft.primarySkillId,
    mediaIds: draft.media.map((media) => media.id),
    difficulty: draft.difficulty || null,
    estimatedMinutes: draft.estimatedMinutes ? Number(draft.estimatedMinutes) : null,
    materials: draft.materials
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), note: orNull(item.note) })),
    steps: draft.steps
      .filter((step) => step.text.trim())
      .map((step) => ({ text: step.text.trim(), mediaId: step.media?.id ?? null })),
    attribution: draft.sourceType
      ? {
          sourceType: draft.sourceType,
          license: draft.license.trim(),
          attributionText: draft.attributionText.trim(),
          originalAuthor: orNull(draft.originalAuthor),
          originalUrl: orNull(draft.originalUrl),
          permissionRef: orNull(draft.permissionRef),
        }
      : null,
    authorUsername: draft.sourceType === "INVITED_CREATOR" ? orNull(draft.authorUsername) : null,
  };
}

/** Alt text typed into the editor, saved with the post. */
function changedAltTexts(draft: Draft, saved: AdminPost | null): Media[] {
  const before = new Map(
    [...(saved?.media ?? []), ...(saved?.steps ?? []).flatMap((step) => step.media ?? [])].map(
      (media) => [media.id, media.altText ?? ""],
    ),
  );
  const current = [...draft.media, ...draft.steps.flatMap((step) => step.media ?? [])];
  return current.filter((media) => (media.altText ?? "") !== (before.get(media.id) ?? ""));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-border-faint bg-card p-4 md:p-6">
      <h2 className="text-control-lg font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-meta text-foreground-secondary">{hint}</p> : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

function moveItem<T>(items: T[], index: number, by: -1 | 1): T[] {
  const next = [...items];
  const [moved] = next.splice(index, 1);
  if (moved) next.splice(index + by, 0, moved);
  return next;
}

type PostEditorProps = { post: AdminPost | null; skills: SkillOption[] };

/**
 * Admin post editor (P1-17, ADM-04/05). Not designed: built from the design system. Save keeps the
 * post as it is (a live post must still meet the publish rules); Publish lists what is missing.
 */
export function PostEditor({ post, skills }: PostEditorProps) {
  const router = useRouter();
  const [saved, setSaved] = useState<AdminPost | null>(post);
  const [draft, setDraft] = useState<Draft>(() => toDraft(post));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function run(action: () => Promise<void>) {
    setPending(true);
    setFormError(null);
    setErrors({});
    try {
      await action();
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fields);
        setFormError(caught.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  async function save(): Promise<AdminPost> {
    for (const media of changedAltTexts(draft, saved)) {
      if (media.altText?.trim()) await updateMediaAltText(media.id, media.altText.trim());
    }
    const payload = toPayload(draft);
    const result = saved
      ? await updateAdminPost(saved.id, payload)
      : await createAdminPost(payload);
    if (!saved) {
      // The draft now exists: give the editor its address without remounting it, so a failed
      // publish keeps its messages and the next Save updates this draft instead of making another.
      window.history.replaceState(null, "", `/admin/posts/${result.id}`);
    }
    setSaved(result);
    setDraft(toDraft(result));
    return result;
  }

  const handleSave = () =>
    run(async () => {
      await save();
      showToast({ message: "Saved." });
    });

  const handlePublish = () =>
    run(async () => {
      const result = await save();
      setSaved(await publishAdminPost(result.id));
      showToast({ message: "Published. It's live on dodoi." });
    });

  const handleUnpublish = () =>
    run(async () => {
      if (!saved) return;
      setSaved(await unpublishAdminPost(saved.id));
      showToast({ message: "Unpublished. It's hidden from everyone." });
    });

  const handleDelete = () =>
    run(async () => {
      if (!saved) return;
      await deleteAdminPost(saved.id);
      router.replace("/admin/posts");
    });

  const source = SOURCES.find((item) => item.value === draft.sourceType);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/posts" className="text-control font-bold text-link hover:underline">
          ← Posts
        </Link>
        {saved ? <StatusBadge status={saved.status} /> : <StatusBadge status="DRAFT" />}
        {saved?.status === "PUBLISHED" ? (
          <Link href={`/p/${saved.id}`} className="text-control text-link hover:underline">
            View on dodoi
          </Link>
        ) : null}
      </div>
      <h1 className="text-title text-foreground md:text-title-web">
        {saved ? "Edit post" : "New post"}
      </h1>

      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="flex flex-col gap-5">
          <Section title="Basics">
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="post-type" label="Type">
                <Select
                  id="post-type"
                  value={draft.type}
                  onChange={(event) => set("type", event.target.value as PostTypeName)}
                >
                  {POST_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="post-title" label="Title" error={errors.title}>
                <Input
                  id="post-title"
                  value={draft.title}
                  maxLength={120}
                  aria-invalid={errors.title ? true : undefined}
                  onChange={(event) => set("title", event.target.value)}
                />
              </Field>
            </div>
            <Field id="post-description" label="Description" error={errors.description}>
              <Textarea
                id="post-description"
                rows={5}
                value={draft.description}
                onChange={(event) => set("description", event.target.value)}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="post-difficulty" label="Difficulty">
                <Select
                  id="post-difficulty"
                  value={draft.difficulty}
                  onChange={(event) =>
                    set("difficulty", event.target.value as ExperienceLevel | "")
                  }
                >
                  <option value="">Not set</option>
                  {LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                id="post-minutes"
                label="Estimated time (minutes)"
                error={errors.estimatedMinutes}
              >
                <Input
                  id="post-minutes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={draft.estimatedMinutes}
                  onChange={(event) => set("estimatedMinutes", event.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title="Skills">
            <SkillsField
              skills={skills}
              selectedIds={draft.skillIds}
              primaryId={draft.primarySkillId}
              onChange={(skillIds, primarySkillId) =>
                setDraft((current) => ({ ...current, skillIds, primarySkillId }))
              }
              error={errors.skillIds ?? errors.primarySkillId}
            />
          </Section>

          <Section title="Photos and videos">
            <MediaField
              label="Gallery (first item is the cover)"
              items={draft.media}
              onChange={(media) => set("media", media)}
              purpose="post"
              max={MAX_POST_MEDIA}
              allowVideo
              error={errors.mediaIds}
            />
          </Section>

          <Section title="Materials">
            <ol className="flex flex-col gap-3">
              {draft.materials.map((material, index) => (
                <li
                  key={material.key}
                  className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end"
                >
                  <Field id={`material-name-${material.key}`} label={`Material ${index + 1}`}>
                    <Input
                      id={`material-name-${material.key}`}
                      value={material.name}
                      maxLength={120}
                      onChange={(event) =>
                        set(
                          "materials",
                          draft.materials.map((item) =>
                            item.key === material.key
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field id={`material-note-${material.key}`} label="Note (optional)">
                    <Input
                      id={`material-note-${material.key}`}
                      value={material.note}
                      maxLength={200}
                      placeholder="e.g. 2 pieces"
                      onChange={(event) =>
                        set(
                          "materials",
                          draft.materials.map((item) =>
                            item.key === material.key
                              ? { ...item, note: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <RowActions
                    label={`material ${index + 1}`}
                    index={index}
                    count={draft.materials.length}
                    onMove={(by) => set("materials", moveItem(draft.materials, index, by))}
                    onRemove={() =>
                      set(
                        "materials",
                        draft.materials.filter((item) => item.key !== material.key),
                      )
                    }
                  />
                </li>
              ))}
            </ol>
            <Button
              variant="outline"
              className="self-start"
              onClick={() =>
                set("materials", [...draft.materials, { key: newKey(), name: "", note: "" }])
              }
            >
              Add material
            </Button>
          </Section>

          <Section title="Steps">
            <FieldError id="steps-error">{errors.steps}</FieldError>
            <ol className="flex flex-col gap-4">
              {draft.steps.map((step, index) => (
                <li
                  key={step.key}
                  className="flex flex-col gap-3 rounded-md border border-border-faint bg-background p-3"
                >
                  <Field id={`step-${step.key}`} label={`Step ${index + 1}`}>
                    <Textarea
                      id={`step-${step.key}`}
                      rows={3}
                      value={step.text}
                      onChange={(event) =>
                        set(
                          "steps",
                          draft.steps.map((item) =>
                            item.key === step.key ? { ...item, text: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <MediaField
                    label="Step photo (optional)"
                    items={step.media ? [step.media] : []}
                    onChange={(media) =>
                      set(
                        "steps",
                        draft.steps.map((item) =>
                          item.key === step.key ? { ...item, media: media[0] ?? null } : item,
                        ),
                      )
                    }
                    purpose="post"
                    max={1}
                  />
                  <RowActions
                    label={`step ${index + 1}`}
                    index={index}
                    count={draft.steps.length}
                    onMove={(by) => set("steps", moveItem(draft.steps, index, by))}
                    onRemove={() =>
                      set(
                        "steps",
                        draft.steps.filter((item) => item.key !== step.key),
                      )
                    }
                  />
                </li>
              ))}
            </ol>
            <Button
              variant="outline"
              className="self-start"
              onClick={() =>
                set("steps", [...draft.steps, { key: newKey(), text: "", media: null }])
              }
            >
              Add step
            </Button>
          </Section>

          <Section title="Source and licence">
            <FieldError id="attribution-error">{errors.attribution}</FieldError>
            <Field id="source-type" label="Where it comes from" hint={source?.hint}>
              <Select
                id="source-type"
                value={draft.sourceType}
                onChange={(event) => set("sourceType", event.target.value as SourceType | "")}
              >
                <option value="">Choose…</option>
                {SOURCES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            {draft.sourceType ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  id="license"
                  label="Licence"
                  error={errors["attribution.license"]}
                  hint='e.g. "Owned", "Pexels License", "CC BY 4.0"'
                >
                  <Input
                    id="license"
                    value={draft.license}
                    maxLength={100}
                    onChange={(event) => set("license", event.target.value)}
                  />
                </Field>
                <Field
                  id="attribution-text"
                  label="Attribution text"
                  error={errors["attribution.attributionText"]}
                >
                  <Input
                    id="attribution-text"
                    value={draft.attributionText}
                    maxLength={300}
                    onChange={(event) => set("attributionText", event.target.value)}
                  />
                </Field>
                <Field
                  id="original-author"
                  label="Original author"
                  error={errors["attribution.originalAuthor"]}
                >
                  <Input
                    id="original-author"
                    value={draft.originalAuthor}
                    maxLength={120}
                    onChange={(event) => set("originalAuthor", event.target.value)}
                  />
                </Field>
                <Field
                  id="original-url"
                  label="Source link"
                  error={errors["attribution.originalUrl"]}
                >
                  <Input
                    id="original-url"
                    type="url"
                    value={draft.originalUrl}
                    placeholder="https://"
                    onChange={(event) => set("originalUrl", event.target.value)}
                  />
                </Field>
                {draft.sourceType === "INVITED_CREATOR" ? (
                  <>
                    <Field
                      id="author-username"
                      label="Creator's dodoi username"
                      error={errors.authorUsername}
                    >
                      <Input
                        id="author-username"
                        value={draft.authorUsername}
                        maxLength={20}
                        onChange={(event) => set("authorUsername", event.target.value)}
                      />
                    </Field>
                    <Field
                      id="permission-ref"
                      label="Permission reference"
                      error={errors["attribution.permissionRef"]}
                      hint="Where the written permission is kept, e.g. an email date."
                    >
                      <Input
                        id="permission-ref"
                        value={draft.permissionRef}
                        maxLength={200}
                        onChange={(event) => set("permissionRef", event.target.value)}
                      />
                    </Field>
                  </>
                ) : null}
              </div>
            ) : null}
            {!draft.sourceType || draft.sourceType === "INVITED_CREATOR" ? null : (
              <FieldError id="author-error">{errors.authorUsername}</FieldError>
            )}
          </Section>
        </div>

        <aside
          aria-label="Post actions"
          className="sticky bottom-0 z-10 -mx-5 flex flex-wrap gap-2 border-t border-border-faint bg-background px-5 py-3 md:-mx-8 md:px-8 lg:top-24 lg:bottom-auto lg:mx-0 lg:flex-col lg:rounded-card lg:border lg:p-4"
        >
          <Button disabled={pending} onClick={handleSave}>
            Save
          </Button>
          {saved?.status === "PUBLISHED" ? (
            <Button variant="outline" disabled={pending} onClick={handleUnpublish}>
              Unpublish
            </Button>
          ) : (
            <Button variant="inverse" disabled={pending} onClick={handlePublish}>
              Save and publish
            </Button>
          )}
          {saved ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="text" disabled={pending} className="lg:self-start">
                  Delete post
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Delete this post?</DialogTitle>
                <DialogDescription>
                  It disappears for everyone, along with its photos and videos that no other post
                  uses. This can&apos;t be undone.
                </DialogDescription>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleDelete}>Delete post</Button>
                  <DialogClose asChild>
                    <Button variant="outline">Keep it</Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function RowActions({
  label,
  index,
  count,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        aria-label={`Move ${label} up`}
      >
        <ArrowUp aria-hidden className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        aria-label={`Move ${label} down`}
      >
        <ArrowDown aria-hidden className="size-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={onRemove} aria-label={`Remove ${label}`}>
        <Trash2 aria-hidden className="size-4" />
      </Button>
    </div>
  );
}
