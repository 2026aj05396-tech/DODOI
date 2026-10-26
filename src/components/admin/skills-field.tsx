"use client";

import { useId, useState } from "react";

import { ToggleChip } from "@/components/ui/chip";
import { FieldError } from "@/components/ui/field-error";
import { SearchField } from "@/components/ui/search-field";

export type SkillOption = { id: string; name: string; status: "ACTIVE" | "HIDDEN" };

type SkillsFieldProps = {
  skills: SkillOption[];
  selectedIds: string[];
  /** Omit (with `withPrimary={false}`) for plain multi-select, e.g. related skills. */
  primaryId?: string | null;
  onChange: (selectedIds: string[], primaryId: string | null) => void;
  withPrimary?: boolean;
  error?: string;
};

/**
 * Pick skills by searching; for posts also the main skill (the first one picked becomes main by
 * default).
 */
export function SkillsField({
  skills,
  selectedIds,
  primaryId = null,
  onChange,
  withPrimary = true,
  error,
}: SkillsFieldProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const selected = selectedIds.flatMap((skillId) => byId.get(skillId) ?? []);
  const term = query.trim().toLowerCase();
  const matches = term
    ? skills.filter((skill) => skill.name.toLowerCase().includes(term)).slice(0, 30)
    : [];

  function toggle(skillId: string, on: boolean) {
    const next = on
      ? [...selectedIds, skillId]
      : selectedIds.filter((idValue) => idValue !== skillId);
    const nextPrimary = next.includes(primaryId ?? "") ? primaryId : (next[0] ?? null);
    onChange(next, nextPrimary);
  }

  return (
    <div className="flex flex-col gap-4">
      {selected.length > 0 && !withPrimary ? (
        <ul aria-label="Chosen skills" className="flex flex-wrap gap-2">
          {selected.map((skill) => (
            <li key={skill.id}>
              <ToggleChip
                variant="interest"
                pressed
                onPressedChange={() => toggle(skill.id, false)}
              >
                {skill.name}
              </ToggleChip>
            </li>
          ))}
        </ul>
      ) : null}
      {selected.length > 0 && withPrimary ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-control-sm font-bold text-foreground">
            Main skill (decides where the post appears first)
          </legend>
          {selected.map((skill) => (
            <label key={skill.id} className="flex items-center gap-2 text-control text-foreground">
              <input
                type="radio"
                name={`${id}-primary`}
                checked={primaryId === skill.id}
                onChange={() => onChange(selectedIds, skill.id)}
                className="size-4 accent-primary"
              />
              {skill.name}
              {skill.status === "HIDDEN" ? (
                <span className="text-meta text-destructive">(hidden)</span>
              ) : null}
              <button
                type="button"
                onClick={() => toggle(skill.id, false)}
                className="ml-auto text-meta font-bold text-link hover:underline"
              >
                Remove
              </button>
            </label>
          ))}
        </fieldset>
      ) : null}
      {selected.length === 0 ? (
        <p className="text-body text-foreground-secondary">None yet. Search to add some.</p>
      ) : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>

      <SearchField
        label="Search skills to add"
        placeholder="Search skills, e.g. crochet"
        appearance="outline"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matches.length > 0 ? (
        <ul aria-label="Matching skills" className="flex flex-wrap gap-2">
          {matches.map((skill) => (
            <li key={skill.id}>
              <ToggleChip
                variant="interest"
                pressed={selectedIds.includes(skill.id)}
                onPressedChange={(on) => toggle(skill.id, on)}
              >
                {skill.name}
                {skill.status === "HIDDEN" ? " (hidden)" : ""}
              </ToggleChip>
            </li>
          ))}
        </ul>
      ) : term ? (
        <p className="text-body text-foreground-secondary">No skill matches “{query.trim()}”.</p>
      ) : null}
    </div>
  );
}
