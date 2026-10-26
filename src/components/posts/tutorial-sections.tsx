"use client";

import { ArrowDown, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { savePostProgress } from "@/lib/api-client/posts";
import { ApiRequestError } from "@/lib/api-client/request";
import type { Media } from "@/lib/types/media";
import type { PostDetail, PostProgress } from "@/lib/types/posts";
import { cn } from "@/lib/utils/cn";

// Materials checklist and steps with progress (P1-20b; POST-11/12, DC-07, DC-24; `1e`, `2c`).
// Ticks show at once and are saved to the account in the background, one request at a time with
// the latest state, so quick taps never arrive out of order. If saving fails, the ticks go back to
// what was last saved and a toast says so. Signed-out visitors see the same lists; tapping sends
// them to sign-in and back to the post (OD-29, PO decision P1-20b).

const SAVE_FAILED = "We couldn't save your progress. Try again.";

type Ticks = { materials: Set<string>; steps: Set<number> };

function toTicks(progress: PostProgress): Ticks {
  return {
    materials: new Set(progress.checkedMaterialIds),
    steps: new Set(progress.completedStepPositions),
  };
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-overline text-foreground-secondary uppercase">
      {children}
    </h2>
  );
}

function StepImage({ media }: { media: Media }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary sizes the image.
    <img
      src={media.url}
      alt={media.altText ?? ""}
      width={media.width}
      height={media.height}
      loading="lazy"
      className="h-auto w-full max-w-md rounded-md bg-muted"
    />
  );
}

export function TutorialSections({
  postId,
  materials,
  steps,
  initialProgress,
}: {
  postId: string;
  materials: PostDetail["materials"];
  steps: PostDetail["steps"];
  /** Null for signed-out visitors. */
  initialProgress: PostProgress | null;
}) {
  const router = useRouter();
  const isSignedIn = initialProgress !== null;
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(`/p/${postId}`)}`;

  const [ticks, setTicks] = useState<Ticks>(() =>
    toTicks(
      initialProgress ?? { checkedMaterialIds: [], completedStepPositions: [], updatedAt: null },
    ),
  );
  const saved = useRef(ticks);
  const pending = useRef<Ticks | null>(null);
  const isSaving = useRef(false);

  async function flush() {
    const next = pending.current;
    if (isSaving.current || !next) return;
    pending.current = null;
    isSaving.current = true;
    try {
      const progress = await savePostProgress(postId, {
        checkedMaterialIds: [...next.materials],
        completedStepPositions: [...next.steps],
      });
      saved.current = toTicks(progress);
    } catch (error) {
      pending.current = null;
      setTicks(saved.current);
      showToast({ message: error instanceof ApiRequestError ? error.message : SAVE_FAILED });
    } finally {
      isSaving.current = false;
      void flush();
    }
  }

  function update(next: Ticks) {
    if (!isSignedIn) {
      router.push(signInHref);
      return;
    }
    setTicks(next);
    pending.current = next;
    void flush();
  }

  function toggleMaterial(id: string) {
    const materialsTicked = new Set(ticks.materials);
    if (!materialsTicked.delete(id)) materialsTicked.add(id);
    update({ ...ticks, materials: materialsTicked });
  }

  function toggleStep(position: number) {
    const stepsDone = new Set(ticks.steps);
    if (!stepsDone.delete(position)) stepsDone.add(position);
    update({ ...ticks, steps: stepsDone });
  }

  const nextStep = steps.find((step) => !ticks.steps.has(step.position));
  const stepId = (position: number) => `step-${postId}-${position}`;

  function goToNextStep() {
    if (!nextStep) return;
    const element = document.getElementById(stepId(nextStep.position));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    element?.querySelector("button")?.focus({ preventScroll: true });
  }

  const doneCount = steps.filter((step) => ticks.steps.has(step.position)).length;
  const tickedCount = materials.filter((material) => ticks.materials.has(material.id)).length;

  return (
    <>
      {materials.length > 0 ? (
        <section aria-labelledby="post-materials">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <SectionHeading id="post-materials">Materials</SectionHeading>
            {isSignedIn ? (
              <p className="text-meta text-foreground-secondary">
                {tickedCount} of {materials.length} · saved to your account
              </p>
            ) : (
              <Link
                href={signInHref}
                className="rounded-sm text-meta font-bold text-link hover:underline"
              >
                Sign in to tick these off
              </Link>
            )}
          </div>
          <ul className="mt-2.5 divide-y divide-border rounded-card border border-border bg-background">
            {materials.map((material) => {
              const isChecked = ticks.materials.has(material.id);
              return (
                <li key={material.id}>
                  <label className="flex min-h-11.5 cursor-pointer items-center gap-3 px-4 py-2.5">
                    {/* The real checkbox, drawn as the design's box; the tick sits on top. */}
                    <span className="relative flex size-5 shrink-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMaterial(material.id)}
                        className="size-5 cursor-pointer appearance-none rounded-xs border-control border-checkbox bg-background checked:border-selected-border checked:bg-primary"
                      />
                      {isChecked ? (
                        <Check
                          aria-hidden
                          className="pointer-events-none absolute inset-0 m-auto size-3.5 animate-dd-pop text-primary-foreground"
                          strokeWidth={3}
                        />
                      ) : null}
                    </span>
                    <span className="text-body text-foreground">
                      {material.name}
                      {material.note ? (
                        <span className="text-foreground-secondary"> · {material.note}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {steps.length > 0 ? (
        <section aria-labelledby="post-steps">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <SectionHeading id="post-steps">
              {isSignedIn ? `Step ${doneCount} of ${steps.length} · progress saved` : "Steps"}
            </SectionHeading>
            {isSignedIn && nextStep ? (
              <Button variant="text" onClick={goToNextStep} className="text-control-sm">
                Next step
                <ArrowDown aria-hidden className="size-4" />
              </Button>
            ) : null}
          </div>
          <ol className="mt-3 flex flex-col gap-4">
            {steps.map((step, index) => {
              const isDone = ticks.steps.has(step.position);
              const isNext = step.position === nextStep?.position;
              return (
                <li
                  key={step.position}
                  id={stepId(step.position)}
                  className="flex scroll-mt-24 gap-3"
                >
                  <button
                    type="button"
                    aria-pressed={isDone}
                    onClick={() => toggleStep(step.position)}
                    className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-full"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-control-sm font-bold transition-colors",
                        isDone
                          ? "bg-primary text-primary-foreground"
                          : isNext
                            ? "bg-inverse text-inverse-foreground"
                            : "border-control border-foreground text-foreground",
                      )}
                    >
                      {isDone ? (
                        <Check className="size-4 animate-dd-pop" strokeWidth={3} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="sr-only">Step {index + 1} done</span>
                  </button>
                  <div className="flex min-w-0 flex-col gap-2.5 pt-0.5">
                    <p className="text-body-lg whitespace-pre-line text-foreground">{step.text}</p>
                    {step.media ? <StepImage media={step.media} /> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </>
  );
}
