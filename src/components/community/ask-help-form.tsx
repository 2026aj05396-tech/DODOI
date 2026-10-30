"use client";

import { Camera, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { createHelpRequest } from "@/lib/api-client/help";
import { uploadMedia } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import { HELP_BODY_MAX, HELP_MAX_PHOTOS, HELP_TITLE_MAX } from "@/lib/schemas/help";
import type { Media } from "@/lib/types/media";

// Ask for help (HLP-01, F-27 step 1; not designed, built from the system): title, details, one
// skill and up to 3 photos. "Ask the community" in the AI chat opens it with the question filled in.

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export function AskHelpForm({
  skills,
  initial,
  isVerified,
}: {
  skills: { id: string; name: string }[];
  initial: { title: string; body: string; skillId: string };
  isVerified: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [skillId, setSkillId] = useState(initial.skillId);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function addPhoto(file: File) {
    setFormError(null);
    setIsUploading(true);
    try {
      const media = await uploadMedia(file, { purpose: "help" });
      setPhotos((current) => [...current, media]);
    } catch (caught) {
      setFormError(
        caught instanceof ApiRequestError ? caught.message : "We couldn't use that photo.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Give your question a short title.";
    if (!body.trim()) next.body = "Tell makers what you need help with.";
    if (!skillId) next.skillId = "Choose the craft this is about.";
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;
    setIsSending(true);
    try {
      const request = await createHelpRequest({
        title: title.trim(),
        body: body.trim(),
        skillId,
        mediaIds: photos.map((photo) => photo.id),
      });
      showToast({ message: "Your request is posted." });
      router.push(`/community/help/${request.id}`);
    } catch (caught) {
      setIsSending(false);
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fields);
        setFormError(caught.message);
      } else {
        setFormError("We couldn't post that. Try again.");
      }
    }
  }

  return (
    <form method="post" onSubmit={submit} noValidate className="flex flex-col gap-5">
      {!isVerified ? (
        <p role="status" className="rounded-md bg-butter p-3.5 text-body text-foreground">
          Verify your email to ask for help. You can write your question now.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input
          id={`${id}-title`}
          value={title}
          maxLength={HELP_TITLE_MAX}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${id}-title-error` : undefined}
          onChange={(event) => setTitle(event.target.value)}
        />
        <FieldError id={`${id}-title-error`}>{errors.title}</FieldError>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-skill`}>Craft</Label>
        <Select
          id={`${id}-skill`}
          value={skillId}
          aria-invalid={Boolean(errors.skillId)}
          aria-describedby={errors.skillId ? `${id}-skill-error` : undefined}
          onChange={(event) => setSkillId(event.target.value)}
        >
          <option value="">Choose a craft</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </Select>
        <FieldError id={`${id}-skill-error`}>{errors.skillId}</FieldError>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-body`}>What do you need help with?</Label>
        <Textarea
          id={`${id}-body`}
          value={body}
          rows={6}
          maxLength={HELP_BODY_MAX}
          aria-invalid={Boolean(errors.body)}
          aria-describedby={`${id}-body-count${errors.body ? ` ${id}-body-error` : ""}`}
          onChange={(event) => setBody(event.target.value)}
        />
        <p id={`${id}-body-count`} className="text-meta text-foreground-secondary">
          {body.length} / {HELP_BODY_MAX}
        </p>
        <FieldError id={`${id}-body-error`}>{errors.body}</FieldError>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-control-sm font-bold text-foreground">
          Photos (optional, up to {HELP_MAX_PHOTOS})
        </span>
        <ul className="flex flex-wrap gap-2.5">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary serves the sizes in srcSet. */}
              <img
                src={photo.url}
                srcSet={photo.srcSet}
                sizes="96px"
                alt={`Photo ${index + 1}`}
                className="size-24 rounded-md object-cover"
              />
              <button
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() =>
                  setPhotos((current) => current.filter((item) => item.id !== photo.id))
                }
                className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-inverse text-inverse-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
          {photos.length < HELP_MAX_PHOTOS ? (
            <li>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void addPhoto(file);
                }}
              />
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileRef.current?.click()}
                className="flex size-24 flex-col items-center justify-center gap-1 rounded-md border-control border-dashed border-border-strong text-meta text-foreground-secondary hover:bg-muted"
              >
                <Camera aria-hidden className="size-5" />
                {isUploading ? "Uploading…" : "Add a photo"}
              </button>
            </li>
          ) : null}
        </ul>
        <FieldError id={`${id}-media-error`}>{errors.mediaIds}</FieldError>
      </div>

      <FieldError id={`${id}-form-error`}>{formError}</FieldError>
      <div className="flex flex-col gap-2 md:flex-row-reverse">
        <Button
          type="submit"
          disabled={isSending || isUploading || !isVerified}
          className="md:min-w-40"
        >
          {isSending ? "Posting…" : "Post request"}
        </Button>
      </div>
    </form>
  );
}
