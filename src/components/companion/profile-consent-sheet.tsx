"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * The first time the member asks for suggestions (F-23 step 4, AIC-03, AIC-07): asks before their
 * interests and levels are shared with the AI provider. Closing it counts as "Not now".
 */
export function ProfileConsentSheet({
  showFreeTierNotice,
  onAnswer,
}: {
  showFreeTierNotice: boolean;
  onAnswer: (allow: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onAnswer(false))}>
      <DialogContent layout="sheet">
        <DialogTitle>Use your interests to suggest ideas?</DialogTitle>
        <DialogDescription>
          Your interests, levels and the skills you want to learn are sent to our AI provider so the
          suggestions fit you. Your collections and messages are never shared. You can turn this off
          any time in Settings → AI and privacy.
        </DialogDescription>
        {showFreeTierNotice ? (
          <p className="text-control-sm text-foreground-secondary">
            Test version: Google may read what is sent. Don&apos;t share anything personal.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button onClick={() => onAnswer(true)} className="md:flex-1">
            Allow
          </Button>
          <Button variant="outline" onClick={() => onAnswer(false)} className="md:flex-1">
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
