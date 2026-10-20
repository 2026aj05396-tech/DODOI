import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ToggleChip } from "./chip";

describe("ToggleChip", () => {
  it("exposes its state as a pressed toggle button", () => {
    render(
      <ToggleChip pressed onPressedChange={() => undefined}>
        Crochet
      </ToggleChip>,
    );

    expect(screen.getByRole("button", { name: "Crochet" })).toHaveAttribute("aria-pressed", "true");
  });

  it("requests the opposite state when activated by keyboard", async () => {
    const onPressedChange = vi.fn();
    render(
      <ToggleChip variant="interest" pressed={false} onPressedChange={onPressedChange}>
        Embroidery
      </ToggleChip>,
    );

    await userEvent.tab();
    await userEvent.keyboard("{Enter}");

    expect(onPressedChange).toHaveBeenCalledWith(true);
  });
});
