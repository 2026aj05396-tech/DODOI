import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api-client/request";
import type { MessagePerson } from "@/lib/types/messages";

import { NewMessagePanel } from "./new-message-panel";

const api = vi.hoisted(() => ({
  listMessagePeople: vi.fn(),
  startConversation: vi.fn(),
  push: vi.fn(),
  onClose: vi.fn(),
}));

vi.mock("@/lib/api-client/messages", () => ({
  listMessagePeople: api.listMessagePeople,
  startConversation: api.startConversation,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));

function person(overrides: Partial<MessagePerson> = {}): MessagePerson {
  return {
    username: "ravi",
    displayName: "Ravi Kumar",
    avatarUrl: null,
    conversationId: null,
    ...overrides,
  };
}

function renderPanel() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NewMessagePanel onClose={api.onClose} />
    </QueryClientProvider>,
  );
}

describe("NewMessagePanel", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it("starts with suggestions", async () => {
    api.listMessagePeople.mockResolvedValue({ items: [person()], nextCursor: null });
    renderPanel();

    expect(screen.getByRole("status", { name: "Loading people" })).toBeInTheDocument();
    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("Suggested")).toBeInTheDocument();
    expect(api.listMessagePeople).toHaveBeenCalledWith("", null);
  });

  it("searches as the member types and says when no one can be messaged", async () => {
    api.listMessagePeople.mockImplementation(async (q: string) =>
      q === "zed" ? { items: [], nextCursor: null } : { items: [person()], nextCursor: null },
    );
    renderPanel();
    await screen.findByText("Ravi Kumar");

    await userEvent.type(screen.getByLabelText("Search people"), "zed");

    expect(await screen.findByText("No one found that you can message")).toBeInTheDocument();
    expect(api.listMessagePeople).toHaveBeenLastCalledWith("zed", null);
  });

  it("opens an existing conversation without creating one", async () => {
    api.listMessagePeople.mockResolvedValue({
      items: [person({ conversationId: "c7" })],
      nextCursor: null,
    });
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: /Ravi Kumar/ }));

    expect(api.startConversation).not.toHaveBeenCalled();
    expect(api.push).toHaveBeenCalledWith("/messages/c7");
    expect(api.onClose).toHaveBeenCalled();
  });

  it("starts a conversation with a new person and opens it", async () => {
    api.listMessagePeople.mockResolvedValue({ items: [person()], nextCursor: null });
    api.startConversation.mockResolvedValue({ id: "c9", created: true });
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: /Ravi Kumar/ }));

    expect(api.startConversation).toHaveBeenCalledWith("ravi");
    await waitFor(() => expect(api.push).toHaveBeenCalledWith("/messages/c9"));
  });

  it("stays open and tells the member when the conversation cannot start", async () => {
    api.listMessagePeople.mockResolvedValue({ items: [person()], nextCursor: null });
    api.startConversation.mockRejectedValue(
      new ApiRequestError(403, "MESSAGES_CLOSED", "This person isn't taking messages right now."),
    );
    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: /Ravi Kumar/ }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Ravi Kumar/ })).toBeEnabled());
    expect(api.push).not.toHaveBeenCalled();
    expect(api.onClose).not.toHaveBeenCalled();
  });

  it("shows an error with a retry", async () => {
    api.listMessagePeople.mockRejectedValueOnce(new Error("offline"));
    api.listMessagePeople.mockResolvedValue({ items: [person()], nextCursor: null });
    renderPanel();

    expect(await screen.findByText("We couldn't load people.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again|retry/i }));

    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
  });
});
