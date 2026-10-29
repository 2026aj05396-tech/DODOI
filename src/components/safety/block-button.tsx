"use client";

import { Ban } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

import { BlockDialog } from "./block-dialog";

// "Block" on someone's profile (MOD-02, F-22 step 2); opens the confirmation.

export function BlockButton({ username, className }: { username: string; className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        variant="text"
        onClick={() => setIsOpen(true)}
        className={cn("gap-1.5 text-foreground-secondary", className)}
      >
        <Ban aria-hidden className="size-4" />
        Block
      </Button>
      {isOpen ? <BlockDialog username={username} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
