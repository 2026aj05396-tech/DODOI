"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils/cn";

// Text tabs from the design (`1h`, `1i`): active tab is brick, bold, with a 2px underline.

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex gap-5 border-b border-border text-control", className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px border-b-2 border-transparent pb-2.5 text-muted-foreground data-[state=active]:border-link data-[state=active]:font-bold data-[state=active]:text-link",
        className,
      )}
      {...props}
    />
  );
}
