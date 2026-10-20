import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComingSoonCard } from "./coming-soon";

describe("ComingSoonCard", () => {
  it("is marked disabled and contains no interactive controls", () => {
    const { container } = render(
      <ComingSoonCard title="Live sessions" description="Book a 30-min call with a maker." />,
    );

    expect(container.firstElementChild).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
