import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ComingSoonTrigger } from "./coming-soon-trigger";

describe("ComingSoonTrigger", () => {
  it("is announced as a disabled, coming-soon control and is not a link", () => {
    render(
      <ComingSoonTrigger label="Create">
        <span aria-hidden>+</span>
      </ComingSoonTrigger>,
    );

    const trigger = screen.getByRole("button", { name: "Create, coming soon" });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a 'Coming soon' tooltip when tapped", async () => {
    render(
      <ComingSoonTrigger label="Community" hasVisibleLabel>
        Community
      </ComingSoonTrigger>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Community\s*, coming soon/ }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Coming soon");
  });
});
