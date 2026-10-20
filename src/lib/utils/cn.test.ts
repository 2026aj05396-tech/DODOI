import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils/cn";

describe("cn", () => {
  it("joins truthy class names and skips falsy ones", () => {
    expect(cn("px-4", false, undefined, "text-link")).toBe("px-4 text-link");
  });

  it("lets later Tailwind utilities override conflicting earlier ones", () => {
    expect(cn("px-4 bg-primary", "px-6")).toBe("bg-primary px-6");
  });
});
