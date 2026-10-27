"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SkillPicker } from "@/components/onboarding/skill-picker";
import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/chip";
import { ErrorBanner } from "@/components/ui/error-banner";
import { showToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { replaceMySkills } from "@/lib/api-client/me";
import { ApiRequestError } from "@/lib/api-client/request";
import { MIN_ONBOARDING_INTERESTS, type ExperienceLevel } from "@/lib/schemas/me";
import type { UserSkillItem } from "@/lib/types/me";
import type { SkillSummary } from "@/lib/types/skills";
import { levelLabel } from "@/lib/utils/post-labels";

// Your skills (PRF-02/03, ONB-08, USER_FLOWS F-10): interests with levels, can help with and
// want to learn, using the onboarding picker. One screen, linked from Edit profile and Settings
// (PO decision, P1-14). Keeps the onboarding minimum of 3 interests (OD-14); the feed changes on
// its next load.

const LEVELS: ExperienceLevel[] = ["CURIOUS", "BEGINNER", "INTERMEDIATE", "EXPERIENCED"];

type Flag = "isInterest" | "canHelp" | "wantsToLearn";

function serialize(items: UserSkillItem[]): string {
  return JSON.stringify(
    items
      .filter((item) => item.isInterest || item.canHelp || item.wantsToLearn)
      .map((item) => [item.skill.id, item.isInterest, item.canHelp, item.wantsToLearn, item.level])
      .sort(),
  );
}

/** The user's own picks first, then the rest of the catalogue. */
function withPicked(catalogue: SkillSummary[], items: UserSkillItem[], flag: Flag): SkillSummary[] {
  const picked = items.filter((item) => item[flag]).map((item) => item.skill);
  const ids = new Set(picked.map((skill) => skill.id));
  return [...picked, ...catalogue.filter((skill) => !ids.has(skill.id))];
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 id={id} className="text-section text-foreground">
        {title}
      </h2>
      <p className="-mt-1 text-body text-foreground-secondary">{description}</p>
      {children}
    </section>
  );
}

export function SkillsEditor({
  catalogue,
  initialItems,
  canAddOwn,
}: {
  catalogue: SkillSummary[];
  initialItems: UserSkillItem[];
  canAddOwn: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [savedState, setSavedState] = useState(() => serialize(initialItems));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = serialize(items) !== savedState;
  useUnsavedChanges(isDirty);
  const interests = items.filter((item) => item.isInterest);
  const missing = Math.max(MIN_ONBOARDING_INTERESTS - interests.length, 0);

  function update(skill: SkillSummary, change: Partial<Omit<UserSkillItem, "skill">>) {
    setItems((current) => {
      if (current.some((item) => item.skill.id === skill.id)) {
        return current.map((item) => (item.skill.id === skill.id ? { ...item, ...change } : item));
      }
      return [
        ...current,
        { skill, isInterest: false, canHelp: false, wantsToLearn: false, level: null, ...change },
      ];
    });
  }

  const selected = (flag: Flag) => (skillId: string) =>
    items.some((item) => item.skill.id === skillId && item[flag]);

  async function save() {
    setIsSaving(true);
    setError(null);
    try {
      const result = await replaceMySkills({
        items: items
          .filter((item) => item.isInterest || item.canHelp || item.wantsToLearn)
          .map((item) => ({
            skillId: item.skill.id,
            isInterest: item.isInterest,
            canHelp: item.canHelp,
            wantsToLearn: item.wantsToLearn,
            // A level only describes an interest (as in onboarding).
            level: item.isInterest ? item.level : null,
          })),
      });
      setItems(result.items);
      setSavedState(serialize(result.items));
      showToast({ message: "Skills saved. Your feed will follow on its next load." });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ? caught.message : "We couldn't save your skills.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <Section
        id="skills-interests"
        title="Interests"
        description="What you like making or are curious about. These shape your feed."
      >
        <SkillPicker
          skills={withPicked(catalogue, items, "isInterest")}
          isSelected={selected("isInterest")}
          onToggle={(skill, isOn) => update(skill, { isInterest: isOn })}
          canAddOwn={canAddOwn}
          searchLabel="Search interests"
        />
        {interests.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-3" aria-label="Your level in each interest">
            {interests.map((item) => (
              <li key={item.skill.id}>
                <fieldset className="flex flex-col gap-2 rounded-card border border-border-faint bg-card p-4">
                  <legend className="sr-only">Your level in {item.skill.name}</legend>
                  <span aria-hidden className="text-control-lg font-bold text-foreground">
                    {item.skill.name}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.map((level) => (
                      <ToggleChip
                        key={level}
                        pressed={item.level === level}
                        onPressedChange={(isOn) =>
                          update(item.skill, { level: isOn ? level : null })
                        }
                      >
                        {levelLabel(level)}
                      </ToggleChip>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        id="skills-can-help"
        title="Can help with"
        description="Skills you know well enough to share a tip."
      >
        <SkillPicker
          skills={withPicked(catalogue, items, "canHelp")}
          isSelected={selected("canHelp")}
          onToggle={(skill, isOn) => update(skill, { canHelp: isOn })}
          canAddOwn={canAddOwn}
          searchLabel="Search skills you can help with"
        />
      </Section>

      <Section
        id="skills-want-to-learn"
        title="Want to learn"
        description="Skills you'd like to pick up next."
      >
        <SkillPicker
          skills={withPicked(catalogue, items, "wantsToLearn")}
          isSelected={selected("wantsToLearn")}
          onToggle={(skill, isOn) => update(skill, { wantsToLearn: isOn })}
          canAddOwn={canAddOwn}
          searchLabel="Search skills you want to learn"
        />
      </Section>

      <div className="sticky bottom-38 z-10 flex flex-wrap items-center gap-3 rounded-card border border-border bg-background p-3 shadow-float md:bottom-20 xl:bottom-4">
        <Button onClick={() => void save()} disabled={!isDirty || missing > 0 || isSaving}>
          {isSaving ? "Saving…" : "Save skills"}
        </Button>
        <p className="text-meta text-foreground-secondary" aria-live="polite">
          {missing > 0
            ? `Pick ${missing} more ${missing === 1 ? "interest" : "interests"} to save.`
            : isDirty
              ? "You have unsaved changes."
              : "All changes saved."}
        </p>
      </div>
    </div>
  );
}
