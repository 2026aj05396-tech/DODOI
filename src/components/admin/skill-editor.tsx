"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input, Label, Textarea } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { setRelatedSkills, updateAdminSkill } from "@/lib/api-client/admin";
import { updateMediaAltText } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import type { AdminSkill } from "@/lib/types/admin";
import type { Media } from "@/lib/types/media";

import { MediaField } from "./media-field";
import { SkillsField, type SkillOption } from "./skills-field";
import { StatusBadge } from "./status-badge";

type SkillEditorProps = { skill: AdminSkill; cover: Media | null; skills: SkillOption[] };

/** Admin skill editor (P1-17): editorial text, cover, related skills, hide/show (any skill). */
export function SkillEditor({ skill, cover: initialCover, skills }: SkillEditorProps) {
  const router = useRouter();
  const [description, setDescription] = useState(skill.description ?? "");
  const [hint, setHint] = useState(skill.hint ?? "");
  const [pitch, setPitch] = useState(skill.pitch ?? "");
  const [cover, setCover] = useState<Media[]>(initialCover ? [initialCover] : []);
  const [related, setRelated] = useState(skill.relatedSkillIds);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      await action();
      router.refresh();
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
      if (coverMedia?.altText?.trim() && coverMedia.altText !== initialCover?.altText) {
        await updateMediaAltText(coverMedia.id, coverMedia.altText.trim());
      }
      await updateAdminSkill(skill.id, {
        description: description.trim() || null,
        hint: hint.trim() || null,
        pitch: pitch.trim() || null,
        coverMediaId: coverMedia?.id ?? null,
      });
      const before = [...skill.relatedSkillIds].sort().join();
      if ([...related].sort().join() !== before)
        await setRelatedSkills(skill.id, { skillIds: related });
      showToast({ message: "Skill saved." });
    });

  const handleVisibility = () =>
    run(async () => {
      const status = skill.status === "ACTIVE" ? "HIDDEN" : "ACTIVE";
      await updateAdminSkill(skill.id, { status });
      showToast({
        message: status === "HIDDEN" ? "Hidden from everyone." : "Visible on dodoi again.",
      });
    });

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/skills" className="text-control font-bold text-link hover:underline">
        ← Skills
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-title text-foreground md:text-title-web">{skill.name}</h1>
        <StatusBadge status={skill.status} />
        <span className="text-meta text-foreground-secondary">
          {skill.origin === "CUSTOM" ? "Custom (added by a user)" : "Predefined"} · /s/{skill.slug}
        </span>
      </div>
      {formError ? <ErrorBanner>{formError}</ErrorBanner> : null}

      <section className="flex flex-col gap-4 rounded-card border border-border-faint bg-card p-4 md:p-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="skill-description">Description</Label>
          <Textarea
            id="skill-description"
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skill-hint">Card hint</Label>
            <Input
              id="skill-hint"
              maxLength={40}
              value={hint}
              placeholder="e.g. Pairs with drawing"
              onChange={(event) => setHint(event.target.value)}
            />
            <FieldError id="skill-hint-error">{errors.hint}</FieldError>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skill-pitch">“New to you” pitch</Label>
            <Input
              id="skill-pitch"
              maxLength={140}
              value={pitch}
              onChange={(event) => setPitch(event.target.value)}
            />
            <FieldError id="skill-pitch-error">{errors.pitch}</FieldError>
          </div>
        </div>
        <MediaField
          label="Cover image"
          items={cover}
          onChange={setCover}
          purpose="cover"
          max={1}
          error={errors.coverMediaId}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-border-faint bg-card p-4 md:p-6">
        <h2 className="text-control-lg font-bold text-foreground">Related skills</h2>
        <SkillsField
          skills={skills.filter((item) => item.id !== skill.id)}
          selectedIds={related}
          withPrimary={false}
          onChange={(ids) => setRelated(ids)}
          error={errors.skillIds}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={handleSave}>
          Save skill
        </Button>
        <Button variant="outline" disabled={pending} onClick={handleVisibility}>
          {skill.status === "ACTIVE" ? "Hide skill" : "Show skill again"}
        </Button>
      </div>
      {skill.status === "ACTIVE" ? (
        <p className="text-meta text-foreground-secondary">
          Hiding removes it from onboarding, search, skill pages and people&apos;s profiles. Posts
          keep it but can&apos;t be published with it as their main skill.
        </p>
      ) : null}
    </div>
  );
}
