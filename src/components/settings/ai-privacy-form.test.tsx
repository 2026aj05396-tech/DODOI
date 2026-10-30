import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api-client/request";
import type { AIConversationSummary } from "@/lib/types/ai";

import { AiPrivacyForm } from "./ai-privacy-form";

const { updateAIConsents, deleteAIConversation, deleteAllAIConversations, listAIConversations } =
  vi.hoisted(() => ({
    updateAIConsents: vi.fn(),
    deleteAIConversation: vi.fn(),
    deleteAllAIConversations: vi.fn(),
    listAIConversations: vi.fn(),
  }));

vi.mock("@/lib/api-client/ai", () => ({
  updateAIConsents,
  deleteAIConversation,
  deleteAllAIConversations,
  listAIConversations,
}));

function chat(id: string, title: string): AIConversationSummary {
  return {
    id,
    title,
    contextType: "NONE",
    context: null,
    updatedAt: new Date().toISOString(),
  };
}

function renderForm(props: Partial<React.ComponentProps<typeof AiPrivacyForm>> = {}) {
  return render(
    <AiPrivacyForm
      initialConsents={{ AI_IMAGES: true, AI_PROFILE_CONTEXT: false }}
      initialChats={{
        items: [chat("c1", "How do I start crochet?"), chat("c2", "Wavy edge")],
        nextCursor: null,
      }}
      showFreeTierNotice={false}
      {...props}
    />,
  );
}

describe("AiPrivacyForm", () => {
  beforeEach(() => {
    updateAIConsents.mockReset();
    deleteAIConversation.mockReset();
    deleteAllAIConversations.mockReset();
    listAIConversations.mockReset();
  });

  it("shows each switch in its saved state and saves a change at once", async () => {
    updateAIConsents.mockResolvedValue({ AI_IMAGES: true, AI_PROFILE_CONTEXT: true });
    renderForm();

    const photos = screen.getByRole("switch", { name: /Use my photos/ });
    const interests = screen.getByRole("switch", { name: /Use my interests/ });
    expect(photos).toBeChecked();
    expect(interests).not.toBeChecked();

    await userEvent.click(interests);
    expect(interests).toBeChecked();
    expect(updateAIConsents).toHaveBeenCalledWith({ AI_PROFILE_CONTEXT: true });

    await userEvent.click(photos);
    expect(updateAIConsents).toHaveBeenLastCalledWith({ AI_IMAGES: false });
  });

  it("puts a switch back when saving fails", async () => {
    updateAIConsents.mockRejectedValue(new ApiRequestError(500, "INTERNAL_ERROR", "Nope"));
    renderForm();

    const photos = screen.getByRole("switch", { name: /Use my photos/ });
    await userEvent.click(photos);

    await waitFor(() => expect(photos).toBeChecked());
  });

  it("deletes one chat after asking, and all chats with a stronger warning", async () => {
    deleteAIConversation.mockResolvedValue(undefined);
    deleteAllAIConversations.mockResolvedValue(undefined);
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Delete chat: Wavy edge" }));
    const one = await screen.findByRole("dialog");
    expect(one).toHaveTextContent("Delete this chat?");
    await userEvent.click(within(one).getByRole("button", { name: "Delete chat" }));
    await waitFor(() => expect(screen.queryByText("Wavy edge")).toBeNull());
    expect(deleteAIConversation).toHaveBeenCalledWith("c2");
    expect(screen.getByText("How do I start crochet?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete all conversations" }));
    const all = await screen.findByRole("dialog");
    expect(all).toHaveTextContent("Every chat with the companion and the photos in them");
    await userEvent.click(within(all).getByRole("button", { name: "Delete all" }));
    expect(await screen.findByText("No conversations")).toBeInTheDocument();
    expect(deleteAllAIConversations).toHaveBeenCalledTimes(1);
  });

  it("keeps the chat when deleting fails, and loads more on request", async () => {
    deleteAIConversation.mockRejectedValue(new ApiRequestError(500, "INTERNAL_ERROR", "Nope"));
    listAIConversations.mockResolvedValue({ items: [chat("c3", "Third chat")], nextCursor: null });
    renderForm({
      initialChats: { items: [chat("c1", "First chat")], nextCursor: "next" },
      showFreeTierNotice: true,
    });
    expect(screen.getByText(/Test version: Google may read/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete chat: First chat" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete chat" }),
    );
    await waitFor(() => expect(deleteAIConversation).toHaveBeenCalledWith("c1"));
    // The sheet stays open so the member can try again or cancel; the chat is still listed.
    const open = screen.getByRole("dialog");
    await waitFor(() =>
      expect(within(open).getByRole("button", { name: "Delete chat" })).toBeEnabled(),
    );
    await userEvent.click(within(open).getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("First chat")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Third chat")).toBeInTheDocument();
    expect(listAIConversations).toHaveBeenCalledWith("next");
  });
});
