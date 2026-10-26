"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ActionChip, ToggleChip } from "@/components/ui/chip";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import { ApiRequestError } from "@/lib/api-client/request";
import { createCustomSkill, searchSkills } from "@/lib/api-client/skills";
import type { SkillSummary } from "@/lib/types/skills";

/** Searching starts from this many characters (search suggestions rule, PROPOSED P1-24). */
const MIN_SEARCH_LENGTH = 2;
const SEARCH_DELAY_MS = 250;

type SkillPickerProps = {
  /** Skills shown before searching (the predefined catalogue, plus the user's own picks). */
  skills: SkillSummary[];
  isSelected: (skillId: string) => boolean;
  onToggle: (skill: SkillSummary, selected: boolean) => void;
  /** Custom interests need a verified email (OD-08); otherwise the add form explains that. */
  canAddOwn: boolean;
  searchLabel: string;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "done"; query: string; results: SkillSummary[] }
  | { status: "failed"; query: string };

/**
 * Chips for picking skills (design 1b): search with typo tolerance, toggle chips, and
 * "+ Add your own" for a custom interest (ONB-02…04).
 */
export function SkillPicker({
  skills,
  isSelected,
  onToggle,
  canAddOwn,
  searchLabel,
}: SkillPickerProps) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [adding, setAdding] = useState(false);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_SEARCH_LENGTH) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearch({ status: "loading", query: trimmed });
      searchSkills(trimmed)
        .then((page) => {
          if (!cancelled) setSearch({ status: "done", query: trimmed, results: page.items });
        })
        .catch(() => {
          if (!cancelled) setSearch({ status: "failed", query: trimmed });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const searching = trimmed.length >= MIN_SEARCH_LENGTH;
  const shown = searching && search.status === "done" ? search.results : skills;

  return (
    <div className="flex flex-col gap-5">
      <SearchField
        label={searchLabel}
        placeholder="Search crafts, e.g. macramé"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div aria-live="polite" className="sr-only">
        {searching && search.status === "done" ? `${search.results.length} matching skills` : ""}
      </div>

      {searching && search.status === "failed" ? (
        <ErrorBanner>Search isn&apos;t working right now. Pick from the list instead.</ErrorBanner>
      ) : null}

      <ul aria-label="Skills" className="flex flex-wrap gap-2">
        {shown.map((skill) => (
          <li key={skill.id}>
            <ToggleChip
              variant="interest"
              pressed={isSelected(skill.id)}
              onPressedChange={(selected) => onToggle(skill, selected)}
            >
              {skill.name}
            </ToggleChip>
          </li>
        ))}
        {!adding ? (
          <li>
            <ActionChip variant="add" onClick={() => setAdding(true)}>
              + Add your own
            </ActionChip>
          </li>
        ) : null}
      </ul>

      {searching && search.status === "done" && search.results.length === 0 ? (
        <p className="text-body text-foreground-secondary">
          Nothing called “{search.query}” yet. Add it as your own below.
        </p>
      ) : null}

      {adding ? (
        <AddOwnSkill
          initialName={searching ? trimmed : ""}
          canAddOwn={canAddOwn}
          onAdded={(skill) => {
            onToggle(skill, true);
            setAdding(false);
            setQuery("");
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

type AddOwnSkillProps = {
  initialName: string;
  canAddOwn: boolean;
  onAdded: (skill: SkillSummary) => void;
  onCancel: () => void;
};

function AddOwnSkill({ initialName, canAddOwn, onAdded, onCancel }: AddOwnSkillProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canAddOwn) {
    return (
      <div className="flex flex-col gap-3">
        <ErrorBanner>
          Verify your email to add your own interests. Until then, pick from the list. You can add
          more later.
        </ErrorBanner>
        <Button variant="text" className="self-start" onClick={onCancel}>
          OK
        </Button>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      onAdded(await createCustomSkill(name));
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? (caught.fields.name ?? caught.message)
          : "We couldn't add that. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-card border border-border-faint bg-card p-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="own-skill-name">Your own interest</Label>
        <Input
          id="own-skill-name"
          value={name}
          maxLength={40}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby="own-skill-hint"
        />
        <p id="own-skill-hint" className="text-meta text-foreground-secondary">
          2–40 characters, e.g. “Pipe cleaner animals”. Everyone can find it once added.
        </p>
      </div>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || name.trim().length < 2}>
          Add
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
