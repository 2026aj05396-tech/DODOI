"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import { showToast } from "@/components/ui/toast";
import { deleteAdminTheme, updateAdminTheme } from "@/lib/api-client/admin";
import { updateMediaAltText } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import type { AdminPostSummary, AdminTheme } from "@/lib/types/admin";
import type { Media } from "@/lib/types/media";

import { MediaField } from "./media-field";
import { StatusBadge } from "./status-badge";

type ThemeEditorProps = { theme: AdminTheme; posts: AdminPostSummary[] };

/** Admin theme editor (P1-17): details, cover, publish, and the posts in display order. */
export function ThemeEditor({ theme, posts }: ThemeEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(theme.title);
  const [slug, setSlug] = useState(theme.slug);
  const [description, setDescription] = useState(theme.description ?? "");
  const [cover, setCover] = useState<Media[]>(theme.coverMedia ? [theme.coverMedia] : []);
  const [isPublished, setIsPublished] = useState(theme.isPublished);
  const [postIds, setPostIds] = useState(theme.postIds);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const byId = new Map(posts.map((post) => [post.id, post]));
  const term = query.trim().toLowerCase();
  const candidates = term
    ? posts
        .filter((post) => !postIds.includes(post.id) && post.title.toLowerCase().includes(term))
        .slice(0, 20)
    : [];

  async function run(action: () => Promise<void>) {
    setPending(true);
    setErrors({});
    setFormError(null);
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

  const handleSave = () =>
    run(async () => {
      const coverMedia = cover[0];
      if (coverMedia?.altText?.trim() && coverMedia.altText !== theme.coverMedia?.altText) {
        await updateMediaAltText(coverMedia.id, coverMedia.altText.trim());
      }
      await updateAdminTheme(theme.id, {
        title,
        slug,
        description: description.trim() || null,
        coverMediaId: coverMedia?.id ?? null,
        isPublished,
        postIds,
      });
      showToast({ message: "Theme saved." });
      router.refresh();
    });

  const handleDelete = () =>
    run(async () => {
      await deleteAdminTheme(theme.id);
      router.replace("/admin/themes");
    });

  function move(index: number, by: -1 | 1) {
    const next = [...postIds];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(index + by, 0, moved);
    setPostIds(next);
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/themes" className="text-control font-bold text-link hover:underline">
        ← Themes
      </Link>
      <h1 className="text-title text-foreground md:text-title-web">Edit theme</h1>
      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}

      <section className="flex flex-col gap-4 rounded-card border border-border-faint bg-card p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="theme-title">Title</Label>
            <Input
              id="theme-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
            />
            <FieldError id="theme-title-error">{errors.title}</FieldError>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="theme-slug">Address</Label>
            <Input
              id="theme-slug"
              value={slug}
              maxLength={80}
              onChange={(event) => setSlug(event.target.value)}
            />
            <p className="text-meta text-foreground-secondary">dodoi.app/t/{slug || "…"}</p>
            <FieldError id="theme-slug-error">{errors.slug}</FieldError>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="theme-description">Description</Label>
          <Textarea
            id="theme-description"
            rows={3}
            value={description}
            maxLength={1000}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <MediaField
          label="Cover image"
          items={cover}
          onChange={setCover}
          purpose="cover"
          max={1}
          error={errors.coverMediaId}
        />
        <label className="flex items-center gap-2 text-control text-foreground">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(event) => setIsPublished(event.target.checked)}
            className="size-4 accent-primary"
          />
          Published (visible on dodoi)
        </label>
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-border-faint bg-card p-4 md:p-6">
        <h2 className="text-control-lg font-bold text-foreground">Posts in this theme</h2>
        <p className="text-body text-foreground-secondary">
          Shown in this order. Only published posts appear on dodoi.
        </p>
        <FieldError id="theme-posts-error">{errors.postIds}</FieldError>
        {postIds.length === 0 ? (
          <p className="text-body text-foreground-secondary">No posts yet. Search to add some.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {postIds.map((postId, index) => {
              const post = byId.get(postId);
              return (
                <li
                  key={postId}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border-faint bg-background p-3"
                >
                  <span className="min-w-0 flex-1 truncate text-control font-bold text-foreground">
                    {index + 1}. {post?.title ?? "Deleted post"}
                  </span>
                  {post ? <StatusBadge status={post.status} /> : null}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${post?.title ?? "post"} up`}
                  >
                    <ArrowUp aria-hidden className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={index === postIds.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${post?.title ?? "post"} down`}
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPostIds(postIds.filter((item) => item !== postId))}
                    aria-label={`Remove ${post?.title ?? "post"}`}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
        <SearchField
          label="Search posts to add"
          placeholder="Search posts by title"
          appearance="outline"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {candidates.length > 0 ? (
          <ul aria-label="Matching posts" className="flex flex-col gap-1">
            {candidates.map((post) => (
              <li key={post.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-control text-foreground">{post.title}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPostIds([...postIds, post.id])}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={handleSave}>
          Save theme
        </Button>
        <Button variant="text" disabled={pending} onClick={handleDelete}>
          Delete theme
        </Button>
      </div>
    </div>
  );
}
