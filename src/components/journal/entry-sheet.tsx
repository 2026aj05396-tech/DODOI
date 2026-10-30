"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { ProgressRing } from "@/components/create/media-thumb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label, Textarea } from "@/components/ui/input";
import { VoiceInputButton, VoiceInputStatus } from "@/components/ui/voice-input";
import { useVoiceTyping } from "@/hooks/use-voice-typing";
import { addEntry, updateEntry } from "@/lib/api-client/journal";
import { uploadMedia } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import { MAX_ENTRY_PHOTOS } from "@/lib/schemas/journal";
import type { Project, ProjectEntry } from "@/lib/types/journal";
import type { Media } from "@/lib/types/media";

// Add or edit a progress entry (F-18 step 3, JRN-02): an optional title (design `1g`), a few
// words, up to 4 photos that upload as soon as they are picked.

type Photo = { key: string; media: Media | null; previewUrl: string; progress: number };

let nextKey = 1;

export function EntrySheet({
  open,
  onOpenChange,
  projectId,
  entry,
  nextNumber,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** The entry being edited; null to add a new one. */
  entry: ProjectEntry | null;
  nextNumber: number;
  onSaved: (project: Project) => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceTyping({
    inputRef: bodyRef,
    value: body,
    maxLength: 2_000,
    onValueChange: setBody,
  });
  const [photos, setPhotos] = useState<Photo[]>(
    () =>
      entry?.media.map((media) => ({
        key: `m-${media.id}`,
        media,
        previewUrl: media.url,
        progress: 1,
      })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const isUploading = photos.some((photo) => !photo.media);

  function addPhotos(files: File[]) {
    const room = MAX_ENTRY_PHOTOS - photos.length;
    for (const file of files.slice(0, room)) {
      const key = `p-${nextKey++}`;
      const previewUrl = URL.createObjectURL(file);
      setPhotos((current) => [...current, { key, media: null, previewUrl, progress: 0 }]);
      uploadMedia(file, {
        purpose: "entry",
        onProgress: (progress) =>
          setPhotos((current) =>
            current.map((photo) => (photo.key === key ? { ...photo, progress } : photo)),
          ),
      })
        .then((media) =>
          setPhotos((current) =>
            current.map((photo) => (photo.key === key ? { ...photo, media } : photo)),
          ),
        )
        .catch((failure: unknown) => {
          setPhotos((current) => current.filter((photo) => photo.key !== key));
          setError(
            failure instanceof ApiRequestError
              ? failure.message
              : "A photo didn't upload. Try again.",
          );
        });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mediaIds = photos.flatMap((photo) => (photo.media ? [photo.media.id] : []));
    const fields = { title: title.trim() || null, body: body.trim() || null, mediaIds };
    if (!fields.title && !fields.body && mediaIds.length === 0) {
      setError("Add a few words or a photo.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      onSaved(
        entry ? await updateEntry(projectId, entry.id, fields) : await addEntry(projectId, fields),
      );
      onOpenChange(false);
    } catch (failure) {
      setError(
        failure instanceof ApiRequestError ? failure.message : "We couldn't save it. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent layout="sheet" className="md:max-w-lg">
        <DialogTitle>{entry ? `Edit entry ${entry.number}` : `Entry ${nextNumber}`}</DialogTitle>
        <DialogDescription>How is it going? A photo and a line are plenty.</DialogDescription>
        <form method="post" onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-title">Title (optional)</Label>
            <Input
              id="entry-title"
              value={title}
              maxLength={80}
              placeholder="e.g. Finished the petals!"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-body">What happened</Label>
            <Textarea
              id="entry-body"
              ref={bodyRef}
              rows={4}
              maxLength={2_000}
              placeholder="What worked, what didn't, what's next?"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <VoiceInputStatus voice={voice} />
              </div>
              <VoiceInputButton voice={voice} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-control font-bold text-foreground">
              Photos ({photos.length} of {MAX_ENTRY_PHOTOS})
            </span>
            <ul className="grid grid-cols-4 gap-2">
              {photos.map((photo, index) => (
                <li key={photo.key} className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview or Cloudinary file */}
                  <img
                    src={photo.previewUrl}
                    alt=""
                    className="size-full animate-dd-pop rounded-md object-cover"
                  />
                  {photo.media ? null : (
                    <span className="absolute inset-0 flex items-center justify-center rounded-md bg-inverse/30">
                      <ProgressRing progress={photo.progress} />
                      <span className="sr-only">Uploading</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((current) => current.filter((other) => other.key !== photo.key))
                    }
                    aria-label={`Remove photo ${index + 1}`}
                    className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-inverse text-inverse-foreground"
                  >
                    <X aria-hidden className="size-3.5" strokeWidth={2.5} />
                  </button>
                </li>
              ))}
              {photos.length < MAX_ENTRY_PHOTOS ? (
                <li>
                  <input
                    ref={input}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    multiple
                    aria-label="Add photos to this entry"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(event) => {
                      addPhotos(event.target.files ? Array.from(event.target.files) : []);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => input.current?.click()}
                    className="flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-md border-2 border-dashed border-border-strong text-meta text-foreground-secondary hover:border-link hover:text-link"
                  >
                    <ImagePlus aria-hidden className="size-5" />
                    Add
                  </button>
                </li>
              ) : null}
            </ul>
          </div>

          {error ? <ErrorBanner>{error}</ErrorBanner> : null}
          <Button type="submit" size="lg" disabled={isSaving || isUploading}>
            {isUploading ? "Uploading…" : isSaving ? "Saving…" : entry ? "Save" : "Add entry"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
