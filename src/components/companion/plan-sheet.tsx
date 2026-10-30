"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import { AI_TEXT_MAX_LENGTH } from "@/lib/schemas/ai";
import type { CompanionSetup } from "@/lib/types/ai";

/** "Plan a project" (F-25 step 1): what to make, and the craft if the member knows it. */
export function PlanSheet({
  skills,
  onSubmit,
  onClose,
}: {
  skills: CompanionSetup["skills"];
  onSubmit: (input: { text: string; skillId?: string }) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [skillId, setSkillId] = useState("");

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent layout="sheet">
        <DialogTitle>Plan a project</DialogTitle>
        <DialogDescription>
          Tell me what you&apos;d like to make and I&apos;ll suggest materials and steps.
        </DialogDescription>
        <form
          method="post"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) onSubmit({ text: text.trim(), ...(skillId ? { skillId } : {}) });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-text`}>What would you like to make?</Label>
            <textarea
              id={`${id}-text`}
              value={text}
              rows={3}
              maxLength={AI_TEXT_MAX_LENGTH}
              onChange={(event) => setText(event.target.value)}
              className="w-full rounded-md border-control border-input bg-background px-3.5 py-3 text-control-lg text-foreground"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-craft`}>Craft (optional)</Label>
            <select
              id={`${id}-craft`}
              value={skillId}
              onChange={(event) => setSkillId(event.target.value)}
              className="h-12 w-full rounded-md border-control border-input bg-background px-3 text-control-lg text-foreground"
            >
              <option value="">Not sure yet</option>
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={text.trim() === ""}>
            Make a plan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
