"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * The first time a member adds a photo (F-24 step 1, AIC-07). Closing it counts as Cancel; the
 * photo is not uploaded until they allow it.
 */
export function PhotoConsentSheet({
  showFreeTierNotice,
  onAnswer,
}: {
  showFreeTierNotice: boolean;
  onAnswer: (allow: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onAnswer(false))}>
      <DialogContent layout="sheet">
        <DialogTitle>Send this photo to the companion?</DialogTitle>
        <DialogDescription>
          Your photo is sent to our AI provider to answer this question. It is kept with this chat
          for 30 days, and you can delete it any time. You can turn this off in Settings → AI and
          privacy.
        </DialogDescription>
        {showFreeTierNotice ? (
          <p className="text-control-sm text-foreground-secondary">
            Test version: Google may read your questions and photos. Don&apos;t share anything
            personal.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button onClick={() => onAnswer(true)} className="md:flex-1">
            Allow
          </Button>
          <Button variant="outline" onClick={() => onAnswer(false)} className="md:flex-1">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
