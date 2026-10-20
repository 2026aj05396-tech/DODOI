"use client";

import { X } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { useSyncExternalStore } from "react";

// Short, actionable toasts (UI_UX_GUIDELINES §4): auto-dismiss after at least 5 s, pause on
// hover/focus (Radix), optional single action such as "Undo". Render <Toaster /> once in the root
// layout and call `showToast()` from client code.

const MIN_DURATION_MS = 5000;

export type ToastOptions = {
  message: string;
  action?: { label: string; onAction: () => void };
  durationMs?: number;
};

type ToastEntry = ToastOptions & { id: number };

let toasts: ToastEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dismissToast(id: number): void {
  toasts = toasts.filter((entry) => entry.id !== id);
  emit();
}

/** Shows a toast. Returns a function that dismisses it early. */
export function showToast(options: ToastOptions): () => void {
  const id = nextId++;
  toasts = [...toasts, { ...options, id }];
  emit();
  return () => dismissToast(id);
}

const EMPTY: ToastEntry[] = [];

export function Toaster() {
  const entries = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );

  return (
    <ToastPrimitive.Provider swipeDirection="down" label="Notifications">
      {entries.map((entry) => (
        <ToastPrimitive.Root
          key={entry.id}
          duration={Math.max(entry.durationMs ?? MIN_DURATION_MS, MIN_DURATION_MS)}
          onOpenChange={(open) => {
            if (!open) dismissToast(entry.id);
          }}
          className="flex animate-dd-up items-center gap-3 rounded-card bg-inverse px-4 py-3 text-control text-inverse-foreground shadow-float"
        >
          <ToastPrimitive.Description className="flex-1">
            {entry.message}
          </ToastPrimitive.Description>
          {entry.action ? (
            <ToastPrimitive.Action
              altText={entry.action.label}
              onClick={entry.action.onAction}
              className="font-bold text-butter"
            >
              {entry.action.label}
            </ToastPrimitive.Action>
          ) : null}
          <ToastPrimitive.Close
            aria-label="Dismiss"
            className="flex size-8 items-center justify-center rounded-full"
          >
            <X aria-hidden className="size-4" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed inset-x-4 bottom-24 z-50 flex flex-col gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:w-96" />
    </ToastPrimitive.Provider>
  );
}
