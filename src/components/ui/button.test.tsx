import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders a non-submitting button by default", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("renders its child element with button styles when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/explore">Explore</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Explore" });
    expect(link).toHaveAttribute("href", "/explore");
    expect(link.className).toContain("rounded-full");
  });
});
