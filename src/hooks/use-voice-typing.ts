"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useIsOnline } from "@/hooks/use-is-online";
import { insertSpokenText } from "@/lib/utils/voice-text";

// Voice typing (P2-10, VOI-01…09): the browser's own speech recognition turns speech into text and
// this hook puts the final words into a text box at the caret. dodoi never sees audio, and nothing
// is sent or saved by dictation alone.

/** English (India) in the first release (VOI-04). */
export const VOICE_LANGUAGE = "en-IN";

export type VoiceError = "blocked" | "no-speech" | "unavailable";

export const VOICE_ERROR_MESSAGES: Record<VoiceError, string> = {
  blocked: "Microphone is blocked. Allow it in your browser's site settings, or type instead.",
  "no-speech": "We didn't hear anything. Tap the mic and try again.",
  unavailable: "Voice typing isn't working right now. You can type instead.",
};

type RecognitionResult = { isFinal: boolean; 0: { transcript: string }; length: number };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };

// The browser type is not in TypeScript's DOM library, so only the parts used here are described.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionConstructor = new () => Recognition;

function getRecognitionConstructor(): RecognitionConstructor | null {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const NOTHING = () => () => undefined;

/** Only one box listens at a time (VOI-02): starting another stops the first. */
let active: { recognition: Recognition; stop: () => void } | null = null;

export type VoiceTypingField = HTMLTextAreaElement | HTMLInputElement;

export type VoiceTyping = {
  /** False on the server, in browsers without speech recognition (Firefox) and until hydrated. */
  isSupported: boolean;
  isOnline: boolean;
  status: "idle" | "starting" | "listening";
  /** Words still being recognised; shown beside "Listening…", inserted only when final. */
  interim: string;
  error: VoiceError | null;
  /** For screen readers: "Listening", "Stopped" or "". */
  announcement: string;
  start: () => void;
  stop: () => void;
  /** Puts the caret back in the text box (after the first-use note closes). */
  focusField: () => void;
};

export function useVoiceTyping({
  inputRef,
  value,
  onValueChange,
  maxLength,
  disabled = false,
}: {
  inputRef: RefObject<VoiceTypingField | null>;
  value: string;
  onValueChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
}): VoiceTyping {
  const isSupported = useSyncExternalStore(
    NOTHING,
    () => getRecognitionConstructor() !== null,
    () => false,
  );
  const isOnline = useIsOnline();
  const [status, setStatus] = useState<VoiceTyping["status"]>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<VoiceError | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const recognitionRef = useRef<Recognition | null>(null);
  const valueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  const hadTextRef = useRef(false);

  useEffect(() => {
    valueRef.current = value;
    onValueChangeRef.current = onValueChange;
  });

  const finish = useCallback(() => {
    if (active && active.recognition === recognitionRef.current) active = null;
    recognitionRef.current = null;
    hadTextRef.current = false;
    setStatus("idle");
    setInterim("");
    setAnnouncement((previous) => (previous === "Listening" ? "Stopped" : previous));
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      // Already stopped.
    }
    finish();
  }, [finish]);

  const insert = useCallback(
    (spoken: string) => {
      const field = inputRef.current;
      const current = valueRef.current;
      const start = field?.selectionStart ?? current.length;
      const end = field?.selectionEnd ?? current.length;
      const result = insertSpokenText(current, spoken, start, end, maxLength);
      if (result.value === current) return;
      valueRef.current = result.value;
      hadTextRef.current = true;
      onValueChangeRef.current(result.value);
      // The caret goes after the new words once React has written the value.
      requestAnimationFrame(() => {
        const target = inputRef.current;
        if (target && document.activeElement === target) {
          target.setSelectionRange(result.caret, result.caret);
        }
      });
    },
    [inputRef, maxLength],
  );

  const start = useCallback(() => {
    if (disabled || !navigator.onLine || recognitionRef.current) return;
    const Constructor = getRecognitionConstructor();
    if (!Constructor) return;

    active?.stop();
    // The words go where the caret is, and leaving the box stops listening (VOI-02).
    inputRef.current?.focus({ preventScroll: true });
    const recognition = new Constructor();
    recognition.lang = VOICE_LANGUAGE;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (event) => {
      let heard = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        const transcript = result[0].transcript;
        if (result.isFinal) insert(transcript);
        else heard += transcript;
      }
      setInterim(heard.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      if (event.error === "not-allowed") setError("blocked");
      else if (event.error === "no-speech") setError("no-speech");
      else setError("unavailable");
    };
    recognition.onend = finish;

    recognitionRef.current = recognition;
    active = { recognition, stop };
    setError(null);
    setStatus("starting");
    setAnnouncement("Listening");
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      active = null;
      setStatus("idle");
      setError("unavailable");
    }
  }, [disabled, finish, inputRef, insert, stop]);

  const focusField = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [inputRef]);

  const isActive = status !== "idle";

  // Stop when the page is hidden or the connection drops (VOI-02, VOI-06).
  useEffect(() => {
    if (!isActive) return;
    const onHidden = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [isActive, stop]);

  useEffect(() => {
    if (!isOnline && isActive) stop();
  }, [isOnline, isActive, stop]);

  // Stop when the box loses focus to something other than the mic button.
  useEffect(() => {
    const field = inputRef.current;
    if (!isActive || !field) return;
    const onBlur = () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (active !== field && !active?.closest("[data-voice-button]")) stop();
      }, 0);
    };
    field.addEventListener("blur", onBlur);
    return () => field.removeEventListener("blur", onBlur);
  }, [inputRef, isActive, stop]);

  // The box was emptied after dictating: the message was sent, so stop listening.
  useEffect(() => {
    if (isActive && value === "" && hadTextRef.current) stop();
  }, [isActive, value, stop]);

  useEffect(() => stop, [stop]);

  return { isSupported, isOnline, status, interim, error, announcement, start, stop, focusField };
}
