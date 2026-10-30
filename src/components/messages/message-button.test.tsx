import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api-client/request";

import { MessageButton } from "./message-button";

const api = vi.hoisted(() => ({ startConversation: vi.fn(), push: vi.fn() }));

vi.mock("@/lib/api-client/messages", () => ({ startConversation: api.startConversation }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));

describe("MessageButton", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it("opens the conversation with the person", async () => {
    api.startConversation.mockResolvedValue({ id: "c9", created: true });
    render(<MessageButton username="ravi" />);

    await userEvent.click(screen.getByRole("button", { name: "Message @ravi" }));

    expect(api.startConversation).toHaveBeenCalledWith("ravi");
    await waitFor(() => expect(api.push).toHaveBeenCalledWith("/messages/c9"));
  });

  it("stays put and tells the member when it cannot open", async () => {
    api.startConversation.mockRejectedValue(
      new ApiRequestError(403, "MESSAGES_CLOSED", "This person isn't taking messages right now."),
    );
    render(<MessageButton username="ravi" />);

    await userEvent.click(screen.getByRole("button", { name: "Message @ravi" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Message @ravi" })).toBeEnabled(),
    );
    expect(api.push).not.toHaveBeenCalled();
  });
});
