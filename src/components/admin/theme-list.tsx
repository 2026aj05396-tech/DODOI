"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label } from "@/components/ui/input";
import { createAdminTheme } from "@/lib/api-client/admin";
import { ApiRequestError } from "@/lib/api-client/request";
import type { AdminTheme } from "@/lib/types/admin";

/** Turns a title into a theme address, e.g. "Cosy nights in" → "cosy-nights-in". */
function toSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Admin theme list and "New theme" (P1-17). */
export function ThemeList({ themes }: { themes: AdminTheme[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const theme = await createAdminTheme({
        title,
        slug: toSlug(title),
        isPublished: false,
        position: themes.length,
        postIds: [],
      });
      router.push(`/admin/themes/${theme.id}`);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fields);
        setFormError(Object.keys(caught.fields).length > 0 ? null : caught.message);
      }
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-foreground md:text-title-web">Themes</h1>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-card border border-border-faint bg-card p-4 md:flex-row md:items-end md:p-6"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="new-theme-title">New theme title</Label>
          <Input
            id="new-theme-title"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={errors.slug || errors.title ? true : undefined}
          />
          <FieldError id="new-theme-error">{errors.title ?? errors.slug}</FieldError>
        </div>
        <Button type="submit" disabled={pending || !toSlug(title)}>
          Create theme
        </Button>
      </form>
      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}

      {themes.length === 0 ? (
        <EmptyState
          title="No themes yet"
          description="Themes group posts, e.g. “Cosy nights in”."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border-faint rounded-card border border-border-faint bg-card">
          {themes.map((theme) => (
            <li key={theme.id}>
              <Link
                href={`/admin/themes/${theme.id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted"
              >
                <span className="flex flex-col">
                  <span className="text-control-lg font-bold text-foreground">{theme.title}</span>
                  <span className="text-meta text-foreground-secondary">
                    /t/{theme.slug} · {theme.postIds.length} posts
                  </span>
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-meta font-bold text-foreground">
                  {theme.isPublished ? "Published" : "Not published"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
