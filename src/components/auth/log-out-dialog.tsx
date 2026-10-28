"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useSignOut } from "./sign-out-button";

/**
 * "Log out of dodoi?" confirmation (`1i`): a bottom sheet on phones, a centred panel from md up.
 * `children` is the trigger, rendered as is (pass a button).
 */
export function LogOutDialog({ children }: { children: ReactNode }) {
  const { signOut, pending } = useSignOut();

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent layout="sheet" className="gap-3.5 pt-3">
        <span
          aria-hidden
          className="h-1 w-10 self-center rounded-full bg-border-strong md:hidden"
        />
        <DialogTitle className="md:pt-3">Log out of dodoi?</DialogTitle>
        <DialogDescription>
          Your collections, journal and progress stay saved. Log back in anytime.
        </DialogDescription>
        <div className="flex flex-col gap-3.5 pt-1">
          <Button variant="destructive" size="lg" onClick={signOut} disabled={pending}>
            {pending ? "Logging out…" : "Log out"}
          </Button>
          <DialogClose asChild>
            <Button variant="outline" size="lg" className="border-border">
              Cancel
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
