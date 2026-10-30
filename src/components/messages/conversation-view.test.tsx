import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api-client/request";
import type { ConversationDetail, MessageView } from "@/lib/types/messages";

import { ConversationView } from "./conversation-view";

const api = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  listMessages: vi.fn(),
  deleteMessage: vi.fn(),
  hideConversation: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/api-client/messages", () => ({
  sendMessage: api.sendMessage,
  listMessages: api.listMessages,
  deleteMessage: api.deleteMessage,
  hideConversation: api.hideConversation,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: api.replace, back: vi.fn() }) }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

function message(overrides: Partial<MessageView> = {}): MessageView {
  return {
    id: "m1",
    body: "Hello Asha",
    isOwn: false,
    isDeleted: false,
    createdAt: "2026-10-30T10:00:00.000Z",
    cursor: "c1",
    ...overrides,
  };
}

function conversation(overrides: Partial<ConversationDetail> = {}): ConversationDetail {
  return {
    id: "c1",
    with: { username: "ravi", displayName: "Ravi", avatarUrl: null },
    canSend: true,
    messages: [message(), message({ id: "m2", body: "Hi Ravi", isOwn: true, cursor: "c2" })],
    olderCursor: null,
    ...overrides,
  };
}

function renderView(detail: ConversationDetail, isVerified = true) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ConversationView initial={detail} isVerified={isVerified} />
    </QueryClientProvider>,
  );
}

describe("ConversationView", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the person, the messages and no read marks", () => {
    renderView(conversation());

    expect(screen.getByRole("link", { name: "Ravi" })).toHaveAttribute("href", "/u/ravi");
    const log = screen.getByRole("log", { name: "Messages" });
    expect(within(log).getByText("Hello Asha")).toBeInTheDocument();
    expect(within(log).getByText("Hi Ravi")).toBeInTheDocument();
    expect(screen.queryByText(/seen|read/i)).not.toBeInTheDocument();
  });

  it("sends a message, adds it to the list and empties the field", async () => {
    api.sendMessage.mockResolvedValue(
      message({ id: "m3", body: "Thanks!", isOwn: true, cursor: "c3" }),
    );
    renderView(conversation());

    await userEvent.type(screen.getByLabelText("Message to Ravi"), " Thanks! ");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(api.sendMessage).toHaveBeenCalledWith("c1", { body: "Thanks!" });
    expect(await screen.findByText("Thanks!")).toBeInTheDocument();
    expect(screen.getByLabelText("Message to Ravi")).toHaveValue("");
  });

  it("explains a closed door and a wait for a reply, and closes the field when messages are closed", async () => {
    api.sendMessage.mockRejectedValueOnce(
      new ApiRequestError(422, "AWAITING_REPLY", "Wait for them to reply before you send more."),
    );
    renderView(conversation());
    await userEvent.type(screen.getByLabelText("Message to Ravi"), "again");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("Wait for them to reply before you send more."),
    ).toBeInTheDocument();

    api.sendMessage.mockRejectedValueOnce(
      new ApiRequestError(403, "MESSAGES_CLOSED", "This person isn't taking messages right now."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.queryByLabelText("Message to Ravi")).not.toBeInTheDocument());
    expect(
      screen.getAllByText("This person isn't taking messages right now.").length,
    ).toBeGreaterThan(0);
  });

  it("shows no field to unverified members and when the person's door is closed", () => {
    const { unmount } = renderView(conversation(), false);
    expect(screen.getByText("Verify your email to send messages.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Message to Ravi")).not.toBeInTheDocument();
    unmount();

    renderView(conversation({ canSend: false }));
    expect(screen.getByText("This person isn't taking messages right now.")).toBeInTheDocument();
  });

  it("deletes your own message after a confirmation, leaving 'Message deleted'", async () => {
    api.deleteMessage.mockResolvedValue(undefined);
    renderView(conversation());

    await userEvent.click(screen.getByRole("button", { name: "More options for your message" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete message" }));
    expect(api.deleteMessage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete message" }));

    await waitFor(() => expect(api.deleteMessage).toHaveBeenCalledWith("m2"));
    const log = screen.getByRole("log", { name: "Messages" });
    expect(await within(log).findByText("Message deleted")).toBeInTheDocument();
    expect(within(log).queryByText("Hi Ravi")).not.toBeInTheDocument();
  });

  it("offers Report only on their messages", async () => {
    renderView(conversation());

    await userEvent.click(screen.getByRole("button", { name: "More options for this message" }));

    expect(screen.getByRole("menuitem", { name: "Report message" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete message" })).not.toBeInTheDocument();
  });

  it("hides the conversation after a confirmation and returns to the list", async () => {
    api.hideConversation.mockResolvedValue(undefined);
    renderView(conversation());

    await userEvent.click(
      screen.getByRole("button", { name: "More options for this conversation" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Hide conversation" }));
    await userEvent.click(screen.getByRole("button", { name: "Hide conversation" }));

    await waitFor(() => expect(api.replace).toHaveBeenCalledWith("/messages"));
    expect(api.hideConversation).toHaveBeenCalledWith("c1");
  });

  it("asks for newer messages every 10 seconds and adds only the new ones", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.listMessages.mockResolvedValue({
      items: [message({ id: "m4", body: "Are you free?", cursor: "c4" })],
      olderCursor: null,
    });
    renderView(conversation());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(api.listMessages).toHaveBeenCalledWith("c1", { after: "c2" });
    expect(await screen.findByText("Are you free?")).toBeInTheDocument();
  });

  it("loads earlier messages above the current ones", async () => {
    api.listMessages.mockResolvedValue({
      items: [message({ id: "m0", body: "The very first", cursor: "c0" })],
      olderCursor: null,
    });
    renderView(conversation({ olderCursor: "c1" }));

    await userEvent.click(screen.getByRole("button", { name: "Earlier messages" }));

    expect(api.listMessages).toHaveBeenCalledWith("c1", { before: "c1" });
    expect(await screen.findByText("The very first")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Earlier messages" })).not.toBeInTheDocument();
  });
});
