"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { updateMyProfile } from "@/lib/api-client/me";
import { uploadMedia } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import type { MyProfile } from "@/lib/types/me";

// Edit profile (PRF-01/04, USER_FLOWS F-10; not designed, built from the system): photo, name,
// username (once per 30 days, OD-11) and bio. Skills have their own screen (PO decision, P1-14).
// Server errors show on their fields; leaving with unsaved changes asks first.

const BIO_MAX = 300;

type Fields = { displayName: string; username: string; bio: string };

export function EditProfileForm({ profile }: { profile: MyProfile }) {
  const router = useRouter();
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const initial: Fields = {
    displayName: profile.displayName,
    username: profile.username,
    bio: profile.bio ?? "",
  };
  const [fields, setFields] = useState<Fields>(initial);
  const [saved, setSaved] = useState<Fields>(initial);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [changeAvailableAt, setChangeAvailableAt] = useState(profile.usernameChangeAvailableAt);

  const isDirty =
    avatarChanged ||
    fields.displayName !== saved.displayName ||
    fields.username !== saved.username ||
    fields.bio !== saved.bio;
  useUnsavedChanges(isDirty);

  const usernameLocked = changeAvailableAt !== null;
  const unlockDate = changeAvailableAt
    ? new Date(changeAvailableAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })
    : null;

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setIsUploading(true);
    setErrors((current) => ({ ...current, avatarMediaId: "" }));
    try {
      const media = await uploadMedia(file, { purpose: "avatar" });
      setAvatar(media);
      setAvatarChanged(true);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        avatarMediaId:
          error instanceof ApiRequestError ? error.message : "We couldn't upload that photo.",
      }));
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const updated = await updateMyProfile({
        displayName: fields.displayName,
        bio: fields.bio,
        ...(fields.username !== saved.username ? { username: fields.username } : {}),
        ...(avatarChanged ? { avatarMediaId: avatar?.id ?? null } : {}),
      });
      const next = {
        displayName: updated.displayName,
        username: updated.username,
        bio: updated.bio ?? "",
      };
      setFields(next);
      setSaved(next);
      setAvatarChanged(false);
      setChangeAvailableAt(updated.usernameChangeAvailableAt);
      showToast({ message: "Profile saved" });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields);
      } else {
        setFormError(
          error instanceof ApiRequestError ? error.message : "We couldn't save your profile.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  const describe = (field: string, hint?: string) =>
    [errors[field] ? `${id}-${field}-error` : null, hint].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6">
      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-control-sm font-bold text-foreground">Profile photo</legend>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar url={avatar?.url ?? null} className="size-20" />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInput.current?.click()}
            >
              {isUploading ? "Uploading…" : avatar ? "Change photo" : "Add photo"}
            </Button>
            {avatar ? (
              <Button
                type="button"
                variant="text"
                onClick={() => {
                  setAvatar(null);
                  setAvatarChanged(true);
                }}
              >
                Remove photo
              </Button>
            ) : null}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => void choosePhoto(event.target.files?.[0])}
          />
        </div>
        <p className="text-meta text-foreground-secondary">JPEG, PNG, WebP or HEIC, up to 5 MB.</p>
        <FieldError id={`${id}-avatarMediaId-error`}>{errors.avatarMediaId}</FieldError>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-displayName`}>Name</Label>
        <Input
          id={`${id}-displayName`}
          value={fields.displayName}
          maxLength={50}
          autoComplete="name"
          onChange={(event) => setFields({ ...fields, displayName: event.target.value })}
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={describe("displayName")}
        />
        <FieldError id={`${id}-displayName-error`}>{errors.displayName}</FieldError>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-username`}>Username</Label>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-control-lg text-foreground-secondary">
            @
          </span>
          <Input
            id={`${id}-username`}
            value={fields.username}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={usernameLocked}
            onChange={(event) =>
              setFields({ ...fields, username: event.target.value.toLowerCase() })
            }
            aria-invalid={errors.username ? true : undefined}
            aria-describedby={describe("username", `${id}-username-hint`)}
          />
        </div>
        <p id={`${id}-username-hint`} className="text-meta text-foreground-secondary">
          {usernameLocked
            ? `You changed your username recently. You can change it again on ${unlockDate}.`
            : "3–20 lowercase letters, numbers, _ or -, starting with a letter. You can change it once every 30 days."}
        </p>
        <FieldError id={`${id}-username-error`}>{errors.username}</FieldError>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-bio`}>Bio</Label>
        <textarea
          id={`${id}-bio`}
          value={fields.bio}
          maxLength={BIO_MAX}
          rows={4}
          onChange={(event) => setFields({ ...fields, bio: event.target.value })}
          aria-invalid={errors.bio ? true : undefined}
          aria-describedby={describe("bio", `${id}-bio-count`)}
          className="w-full rounded-md border-control border-input bg-background px-3.5 py-3 text-control-lg text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive"
          placeholder="What do you like making?"
        />
        <p id={`${id}-bio-count`} className="text-meta text-foreground-secondary">
          {fields.bio.length} / {BIO_MAX}
        </p>
        <FieldError id={`${id}-bio-error`}>{errors.bio}</FieldError>
      </div>

      <p className="text-body text-foreground-secondary">
        Skills you&apos;re into, can help with or want to learn:{" "}
        <Link href="/settings/skills" className="font-bold text-link hover:underline">
          Edit your skills
        </Link>
      </p>

      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" disabled={isSaving || isUploading || !isDirty}>
          {isSaving ? "Saving…" : "Save profile"}
        </Button>
        <Button asChild variant="outline">
          <Link href={`/u/${saved.username}`}>View profile</Link>
        </Button>
      </div>
    </form>
  );
}
