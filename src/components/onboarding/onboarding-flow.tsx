"use client";

import { getSession } from "next-auth/react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/chip";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Wordmark } from "@/components/ui/wordmark";
import { completeOnboarding, replaceMySkills, saveOnboardingStep } from "@/lib/api-client/me";
import { ApiRequestError } from "@/lib/api-client/request";
import { MIN_ONBOARDING_INTERESTS, ONBOARDING_STEPS, type ExperienceLevel } from "@/lib/schemas/me";
import type { UserSkillItem } from "@/lib/types/me";
import type { SkillSummary } from "@/lib/types/skills";
import { cn } from "@/lib/utils/cn";

import { SkillPicker } from "./skill-picker";

const LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: "CURIOUS", label: "Curious" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "EXPERIENCED", label: "Experienced" },
];

const NEXT_STEP_HINT: Record<number, string> = {
  1: "Next: how familiar are you with each?",
  2: "Next: anything you could help others with?",
  3: "Last step",
};

type OnboardingFlowProps = {
  initialStep: number;
  /** Predefined skills shown before searching. */
  catalogue: SkillSummary[];
  initialItems: UserSkillItem[];
  canAddOwn: boolean;
  /** Where to go when finished (the home feed once it exists). */
  finishPath: string;
};

/**
 * Onboarding (F-05, DC-18): 1 interests (design 1b, at least 3, no Skip) → 2 familiarity →
 * 3 skills you can help with (both optional, built from the design system). Every Continue or
 * Skip saves the step, so a returning user resumes where they left off (P1-10).
 */
export function OnboardingFlow({
  initialStep,
  catalogue,
  initialItems,
  canAddOwn,
  finishPath,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(initialStep);
  const [items, setItems] = useState<UserSkillItem[]>(initialItems);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interests = items.filter((item) => item.isInterest);
  const missing = Math.max(MIN_ONBOARDING_INTERESTS - interests.length, 0);
  const pickerSkills = withSelectedFirst(catalogue, items);

  function update(skill: SkillSummary, change: Partial<Omit<UserSkillItem, "skill">>) {
    setItems((current) => {
      const existing = current.find((item) => item.skill.id === skill.id);
      if (existing) {
        return current.map((item) => (item.skill.id === skill.id ? { ...item, ...change } : item));
      }
      const added: UserSkillItem = {
        skill,
        isInterest: false,
        canHelp: false,
        wantsToLearn: false,
        level: null,
        ...change,
      };
      return [...current, added];
    });
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : "We couldn't save that. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function saveSkills() {
    const saved = await replaceMySkills({
      items: items.map((item) => ({
        skillId: item.skill.id,
        isInterest: item.isInterest,
        canHelp: item.canHelp,
        wantsToLearn: item.wantsToLearn,
        // A level only describes an interest.
        level: item.isInterest ? item.level : null,
      })),
    });
    setItems(saved.items);
  }

  async function goTo(nextStep: number, { save }: { save: boolean }) {
    await run(async () => {
      if (save) await saveSkills();
      await saveOnboardingStep({ step: nextStep });
      setStep(nextStep);
      window.scrollTo({ top: 0 });
    });
  }

  async function finish({ save }: { save: boolean }) {
    await run(async () => {
      if (save) await saveSkills();
      await completeOnboarding();
      // Refresh the session cookie so the proxy knows onboarding is done, then continue.
      await getSession();
      window.location.assign(finishPath);
    });
  }

  return (
    <OnboardingFrame
      step={step}
      error={error}
      footer={
        step === 1 ? (
          <Button
            size="lg"
            className="w-full md:w-auto md:min-w-72"
            disabled={missing > 0 || pending}
            onClick={() => goTo(2, { save: true })}
          >
            {missing > 0
              ? `Pick ${missing} more to continue`
              : `Continue with ${interests.length} interests`}
          </Button>
        ) : (
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <Button
              variant="text"
              disabled={pending}
              onClick={() => goTo(step - 1, { save: false })}
            >
              Back
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="ml-auto"
              disabled={pending}
              onClick={() => (step === 2 ? goTo(3, { save: false }) : finish({ save: false }))}
            >
              Skip
            </Button>
            <Button
              size="lg"
              disabled={pending}
              onClick={() => (step === 2 ? goTo(3, { save: true }) : finish({ save: true }))}
            >
              {step === 2 ? "Continue" : "Finish"}
            </Button>
          </div>
        )
      }
    >
      {step === 1 ? (
        <StepIntro
          title="What do you like making?"
          description="Pick as many as you like, including ones you're only curious about. You can change these any time."
        >
          <SkillPicker
            skills={pickerSkills}
            isSelected={(id) => items.some((item) => item.skill.id === id && item.isInterest)}
            onToggle={(skill, selected) => update(skill, { isInterest: selected })}
            canAddOwn={canAddOwn}
            searchLabel="Search interests"
          />
        </StepIntro>
      ) : null}

      {step === 2 ? (
        <StepIntro
          title="How familiar are you with each?"
          description="No wrong answers. This helps us pick ideas at the right level. You can skip it."
        >
          <ul className="flex flex-col gap-4">
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
                        key={level.value}
                        pressed={item.level === level.value}
                        onPressedChange={(pressed) =>
                          update(item.skill, { level: pressed ? level.value : null })
                        }
                      >
                        {level.label}
                      </ToggleChip>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ul>
        </StepIntro>
      ) : null}

      {step === 3 ? (
        <StepIntro
          title="Anything you could help others with?"
          description="Pick skills you know well enough to share a tip. You can skip this and add them later."
        >
          <SkillPicker
            skills={withSelectedFirst(
              interests.map((item) => item.skill),
              items.filter((item) => item.canHelp),
            )}
            isSelected={(id) => items.some((item) => item.skill.id === id && item.canHelp)}
            onToggle={(skill, selected) => update(skill, { canHelp: selected })}
            canAddOwn={canAddOwn}
            searchLabel="Search skills you can help with"
          />
        </StepIntro>
      ) : null}
    </OnboardingFrame>
  );
}

/** Puts skills the user already picked (including custom ones) in front of the list. */
function withSelectedFirst(skills: SkillSummary[], items: UserSkillItem[]): SkillSummary[] {
  const picked = items.map((item) => item.skill);
  const pickedIds = new Set(picked.map((skill) => skill.id));
  return [...picked, ...skills.filter((skill) => !pickedIds.has(skill.id))];
}

function StepIntro({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-balance text-foreground md:text-title-web">{title}</h1>
        <p className="max-w-2xl text-body-lg text-foreground-secondary md:text-body-lg-web">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

type OnboardingFrameProps = {
  step: number;
  error: string | null;
  footer: ReactNode;
  children: ReactNode;
};

/**
 * Full-screen frame (no app navigation): progress segments, content, and a footer that sticks to
 * the bottom with "Step n of 3". Mobile follows 1b; wider screens use a centred 768px column.
 */
function OnboardingFrame({ step, error, footer, children }: OnboardingFrameProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="flex items-center gap-6 px-6 pt-5 md:px-10 md:pt-8">
        <Wordmark className="hidden md:inline-flex" />
        <div aria-hidden className="flex gap-1.5">
          {Array.from({ length: ONBOARDING_STEPS }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1 w-7 rounded-full md:w-10",
                index < step ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>
      </header>

      <main className="flex-1 px-6 pt-7 pb-8 md:px-10 md:pt-10">{children}</main>

      <footer className="sticky bottom-0 flex flex-col gap-2.5 border-t border-border-faint bg-background px-6 pt-4 pb-9 md:flex-row md:items-center md:justify-between md:px-10 md:pb-8">
        <div className="flex flex-col gap-2">
          <p className="text-body text-muted-foreground">
            Step {step} of {ONBOARDING_STEPS} · {NEXT_STEP_HINT[step]}
          </p>
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        </div>
        {footer}
      </footer>
    </div>
  );
}
