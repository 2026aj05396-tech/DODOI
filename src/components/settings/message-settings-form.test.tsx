import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api-client/request";

import { MessageSettingsForm } from "./message-settings-form";

const api = vi.hoisted(() => ({ updateMessageSettings: vi.fn() }));

vi.mock("@/lib/api-client/messages", () => ({ updateMessageSettings: api.updateMessageSettings }));

describe("MessageSettingsForm", () => {
  beforeEach(() => {
    api.updateMessageSettings.mockReset();
  });

  it("shows the current choice and saves a new one at once", async () => {
    api.updateMessageSettings.mockResolvedValue({ messagePolicy: "NOBODY" });
    render(<MessageSettingsForm initial="EVERYONE" />);
    expect(screen.getByRole("radio", { name: /Everyone/ })).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: /No one/ }));

    expect(api.updateMessageSettings).toHaveBeenCalledWith("NOBODY");
    expect(screen.getByRole("radio", { name: /No one/ })).toBeChecked();
  });

  it("puts the old choice back when saving fails", async () => {
    api.updateMessageSettings.mockRejectedValue(new ApiRequestError(500, "INTERNAL_ERROR", "Nope"));
    render(<MessageSettingsForm initial="FOLLOWING" />);

    await userEvent.click(screen.getByRole("radio", { name: /Everyone/ }));

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /People I follow/ })).toBeChecked(),
    );
  });
});
