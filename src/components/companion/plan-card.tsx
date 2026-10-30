"use client";

import { NotebookPen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { createProject } from "@/lib/api-client/journal";
import { ApiRequestError } from "@/lib/api-client/request";
import type { AIPlan } from "@/lib/types/ai";

/**
 * A project plan in the chat (F-25, AIC-04): title, craft, the materials as a read-only list and
 * numbered steps. **Start as my project** makes a private journal project with the materials as
 * its checklist (the steps stay here in the chat).
 */
export function PlanCard({ plan }: { plan: AIPlan }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  async function start() {
    setIsStarting(true);
    try {
      const project = await createProject({
        title: plan.title,
        skillId: plan.skillId,
        visibility: "PRIVATE",
        materials: plan.materials,
      });
      showToast({ message: "Project started. It's in your journal." });
      router.push(`/projects/${project.id}`);
    } catch (caught) {
      setIsStarting(false);
      showToast({
        message: caught instanceof ApiRequestError ? caught.message : "We couldn't start it.",
      });
    }
  }

  return (
    <article
      aria-label={`Plan: ${plan.title}`}
      className="flex max-w-[92%] flex-col gap-4 self-start rounded-2xl rounded-bl-sm border border-border bg-background p-4 text-foreground"
    >
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-xs bg-lavender px-1.5 py-0.5 text-overline font-bold text-plum uppercase">
          AI plan
        </span>
        <h3 className="text-section wrap-break-word">{plan.title}</h3>
        <span className="w-fit rounded-full bg-muted px-3 py-1 text-meta">{plan.craft}</span>
      </header>
      <section aria-label="Materials" className="flex flex-col gap-2">
        <h4 className="text-overline text-foreground-secondary uppercase">Materials</h4>
        <ul className="flex flex-col gap-1.5 text-body">
          {plan.materials.map((material, index) => (
            <li key={index} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-1.5 size-3.5 shrink-0 rounded-xs border border-border-strong"
              />
              {material}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Steps" className="flex flex-col gap-2">
        <h4 className="text-overline text-foreground-secondary uppercase">Steps</h4>
        <ol className="flex flex-col gap-2.5 text-body">
          {plan.steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full border-control border-foreground text-control-sm font-bold"
              >
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </section>
      <p className="text-meta text-foreground-secondary">Answers can be wrong.</p>
      <Button onClick={() => void start()} disabled={isStarting}>
        <NotebookPen aria-hidden className="size-4" />
        {isStarting ? "Starting…" : "Start as my project"}
      </Button>
    </article>
  );
}
