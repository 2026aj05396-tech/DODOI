"use client";

import { Mic, Square } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VOICE_ERROR_MESSAGES, type VoiceTyping } from "@/hooks/use-voice-typing";
import { cn } from "@/lib/utils/cn";

// Voice typing controls (UI_UX_GUIDELINES §8.4, USER_FLOWS F-31). `VoiceInputButton` goes next to
// a text box and `VoiceInputStatus` under it; both take the object from `useVoiceTyping`.

const NOTE_KEY = "dodoi:voice-typing-note";

function hasSeenNote(): boolean {
  try {
    return window.localStorage.getItem(NOTE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberNote(): void {
  try {
    window.localStorage.setItem(NOTE_KEY, "1");
  } catch {
    // Private mode: the note shows again next time.
  }
}

export function VoiceInputButton({
  voice,
  disabled = false,
  className,
}: {
  voice: VoiceTyping;
  disabled?: boolean;
  className?: string;
}) {
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  if (!voice.isSupported) return null;

  const isListening = voice.status !== "idle";
  const label = !voice.isOnline
    ? "Voice typing needs a connection"
    : isListening
      ? "Stop voice typing"
      : "Start voice typing";

  function toggle() {
    if (isListening) voice.stop();
    else if (hasSeenNote()) voice.start();
    else setIsNoteOpen(true);
  }

  return (
    <>
      <Button
        data-voice-button=""
        type="button"
        variant="outline"
        aria-label={label}
        aria-pressed={isListening}
        title={label}
        disabled={disabled || !voice.isOnline}
        // Keep the text box focused, so the keyboard stays open and the caret is not lost.
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
        className={cn(
          "size-11 shrink-0 border-transparent bg-muted p-0 text-foreground-secondary",
          isListening && "border-primary bg-background text-primary ring-2 ring-primary",
          className,
        )}
      >
        {isListening ? (
          <Square aria-hidden className="size-4 fill-current" strokeWidth={1.7} />
        ) : (
          <Mic aria-hidden className="size-5" strokeWidth={1.7} />
        )}
      </Button>
      {isNoteOpen ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : setIsNoteOpen(false))}>
          <DialogContent
            layout="sheet"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              voice.focusField();
            }}
          >
            <DialogTitle>Use your voice to type?</DialogTitle>
            <DialogDescription>
              Your browser turns your speech into text. In Chrome and Edge the audio goes to
              Google&apos;s speech service. dodoi never stores it.
            </DialogDescription>
            <div className="flex flex-col gap-2 md:flex-row-reverse">
              <Button
                className="md:flex-1"
                onClick={() => {
                  rememberNote();
                  setIsNoteOpen(false);
                  voice.start();
                }}
              >
                Continue
              </Button>
              <Button variant="outline" className="md:flex-1" onClick={() => setIsNoteOpen(false)}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

export function VoiceInputStatus({ voice, className }: { voice: VoiceTyping; className?: string }) {
  if (!voice.isSupported) return null;
  const isListening = voice.status !== "idle";

  return (
    <>
      <span role="status" className="sr-only">
        {voice.announcement}
      </span>
      {isListening || voice.error ? (
        <p
          className={cn(
            "text-meta",
            voice.error && !isListening ? "text-destructive" : "text-foreground-secondary",
            className,
          )}
        >
          {isListening ? (
            <>
              <span className="font-bold text-primary">Listening…</span>
              {voice.interim ? <span className="italic"> {voice.interim}</span> : null}
            </>
          ) : voice.error ? (
            VOICE_ERROR_MESSAGES[voice.error]
          ) : null}
        </p>
      ) : null}
    </>
  );
}
