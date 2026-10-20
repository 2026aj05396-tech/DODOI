import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils/cn";

describe("cn", () => {
  it("joins truthy class names and skips falsy ones", () => {
    expect(cn("px-4", false, undefined, "text-link")).toBe("px-4 text-link");
  });

  it("keeps a custom font size and a text colour together", () => {
    expect(cn("text-badge text-foreground", "text-control text-link")).toBe(
      "text-control text-link",
    );
    expect(cn("text-badge-sm", "text-foreground")).toBe("text-badge-sm text-foreground");
  });

  it("keeps the custom border width next to a border colour", () => {
    expect(cn("border-control border-input")).toBe("border-control border-input");
  });

  it("lets later Tailwind utilities override conflicting earlier ones", () => {
    expect(cn("px-4 bg-primary", "px-6")).toBe("bg-primary px-6");
  });
});
