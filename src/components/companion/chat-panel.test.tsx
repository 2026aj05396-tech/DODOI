import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api-client/request";
import type { AIMessageView, CompanionSetup, SendAIMessageResult } from "@/lib/types/ai";

import { ChatPanel, type ChatPanelProps } from "./chat-panel";

const { sendAIMessage, updateAIConsents, createAIPlan, createProject, push } = vi.hoisted(() => ({
  sendAIMessage: vi.fn(),
  updateAIConsents: vi.fn(),
  createAIPlan: vi.fn(),
  createProject: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/api-client/ai", () => ({
  sendAIMessage,
  updateAIConsents,
  createAIPlan,
  sendAIFeedback: vi.fn(),
}));
vi.mock("@/lib/api-client/journal", () => ({ createProject }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const SETUP: CompanionSetup = {
  isAvailable: true,
  showFreeTierNotice: false,
  consents: { AI_IMAGES: false, AI_PROFILE_CONTEXT: false },
  skills: [{ id: "s1", name: "Crochet", slug: "crochet" }],
};

function message(overrides: Partial<AIMessageView>): AIMessageView {
  return {
    id: "m1",
    role: "USER",
    content: "How do I start?",
    image: null,
    status: "OK",
    feedback: null,
    createdAt: "2026-10-29T10:00:00.000Z",
    ...overrides,
  };
}

function result(answer: string): SendAIMessageResult {
  return {
    conversation: {
      id: "c1",
      title: "How do I start?",
      contextType: "NONE",
      context: null,
      updatedAt: "2026-10-29T10:00:00.000Z",
    },
    userMessage: message({ id: "u1" }),
    assistantMessage: message({ id: "a1", role: "ASSISTANT", content: answer }),
  };
}

function renderPanel(props: Partial<ChatPanelProps> = {}) {
  return render(
    <ChatPanel
      setup={SETUP}
      isVerified
      conversationId={null}
      initialMessages={[]}
      context={null}
      variant="page"
      {...props}
    />,
  );
}

describe("ChatPanel", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    sendAIMessage.mockReset();
    updateAIConsents.mockReset();
    createAIPlan.mockReset();
    createProject.mockReset();
    push.mockReset();
  });

  it("shows the test-version notice on the free tier and nothing on a paid tier", () => {
    const { unmount } = renderPanel({ setup: { ...SETUP, showFreeTierNotice: true } });
    expect(
      screen.getByText(
        "Test version: Google may read your questions and photos. Don't share anything personal.",
      ),
    ).toBeInTheDocument();
    unmount();

    renderPanel();
    expect(screen.queryByText(/Test version/)).toBeNull();
  });

  it("sends a question, shows the answer with its AI label and a note, and keeps the field focused", async () => {
    sendAIMessage.mockResolvedValue(result("Start with a magic ring."));
    const onConversationStart = vi.fn();
    renderPanel({ onConversationStart });

    const field = screen.getByLabelText("Your question");
    await userEvent.type(field, "How do I start?{Enter}");

    expect(sendAIMessage).toHaveBeenCalledWith({ text: "How do I start?" });
    expect(await screen.findByText("Start with a magic ring.")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Answers can be wrong.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Helpful" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report" })).toBeInTheDocument();
    expect(onConversationStart).toHaveBeenCalledWith("c1");
    await waitFor(() => expect(field).toHaveFocus());
  });

  it("starts a chat about a post with that context, and continues it with the conversation id", async () => {
    sendAIMessage.mockResolvedValue(result("It is a coaster."));
    renderPanel({
      context: { type: "POST", id: "p1", title: "Crochet coaster" },
      newContext: { type: "POST", id: "p1" },
    });
    expect(screen.getByText(/Looking at/)).toHaveTextContent("Looking at: Crochet coaster");

    await userEvent.type(screen.getByLabelText("Your question"), "What is it?{Enter}");
    await screen.findByText("It is a coaster.");
    await userEvent.type(screen.getByLabelText("Your question"), "Thanks{Enter}");

    expect(sendAIMessage).toHaveBeenNthCalledWith(1, {
      text: "What is it?",
      context: { type: "POST", id: "p1" },
    });
    expect(sendAIMessage).toHaveBeenNthCalledWith(2, { text: "Thanks", conversationId: "c1" });
  });

  it("explains the daily limit in the field with the reset time and stops sending", async () => {
    const resetAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    sendAIMessage.mockRejectedValue(
      new ApiRequestError(429, "AI_QUOTA", "You've used today's questions.", { resetAt }),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText("Your question"), "One more{Enter}");

    const field = await screen.findByLabelText("Your question");
    await waitFor(() => expect(field).toBeDisabled());
    expect(field).toHaveAttribute(
      "placeholder",
      expect.stringMatching(/^You've used today's questions\. They reset at /),
    );
  });

  it("tells the member to slow down on the per-minute limit and keeps their question", async () => {
    const resetAt = new Date(Date.now() + 30 * 1000).toISOString();
    sendAIMessage.mockRejectedValue(
      new ApiRequestError(429, "AI_QUOTA", "Slow down a little.", { resetAt }),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText("Your question"), "Quick one{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Slow down a little. Try again in a minute.",
    );
    expect(screen.getByLabelText("Your question")).toHaveValue("Quick one");
  });

  it("shows the neutral message when the safety filter refuses a question", async () => {
    sendAIMessage.mockRejectedValue(
      new ApiRequestError(422, "AI_BLOCKED", "I can't help with that one."),
    );
    renderPanel();

    await userEvent.type(screen.getByLabelText("Your question"), "Something unsafe{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("I can't help with that one.");
    expect(screen.getByLabelText("Your question")).toHaveValue("");
  });

  it("is disabled with a message when the companion is off or the email is unverified", () => {
    const { unmount } = renderPanel({ setup: { ...SETUP, isAvailable: false } });
    expect(screen.getByLabelText("Your question")).toBeDisabled();
    expect(screen.getByText("The companion is resting. Try again later.")).toBeInTheDocument();
    unmount();

    renderPanel({ isVerified: false });
    expect(screen.getByLabelText("Your question")).toBeDisabled();
    expect(screen.getByText("Verify your email to ask dodoi.")).toBeInTheDocument();
  });

  it("asks before sharing interests the first time suggestions are requested", async () => {
    sendAIMessage.mockResolvedValue(result("Try Crochet."));
    updateAIConsents.mockResolvedValue({ AI_IMAGES: false, AI_PROFILE_CONTEXT: true });
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "What should I try next?" }));
    const sheet = await screen.findByRole("dialog");
    expect(sendAIMessage).not.toHaveBeenCalled();
    await userEvent.click(within(sheet).getByRole("button", { name: "Allow" }));

    await screen.findAllByText(/Try/);
    expect(updateAIConsents).toHaveBeenCalledWith({ AI_PROFILE_CONTEXT: true });
    expect(sendAIMessage).toHaveBeenCalledWith({ text: "What should I try next?" });
    expect(screen.getByRole("link", { name: "Crochet" })).toHaveAttribute("href", "/s/crochet");
  });

  it("still asks the suggestion question after 'Not now', without saving a consent", async () => {
    sendAIMessage.mockResolvedValue(result("Here are ideas."));
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "What should I try next?" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Not now" }),
    );

    await screen.findByText("Here are ideas.");
    expect(updateAIConsents).not.toHaveBeenCalled();
  });

  it("keeps a refused question in the history with the neutral note", () => {
    renderPanel({
      conversationId: "c1",
      initialMessages: [message({ id: "u9", content: "Unsafe thing", status: "BLOCKED" })],
    });

    expect(screen.getByText("Unsafe thing")).toBeInTheDocument();
    expect(screen.getByText("I can't help with that one.")).toBeInTheDocument();
  });

  describe("project plans", () => {
    const PLAN = {
      title: "Granny square coaster",
      craft: "Crochet",
      skillId: "s1",
      materials: ["Cotton yarn", "4 mm hook"],
      steps: ["Make a magic ring.", "Work the first round."],
    };

    async function planOne() {
      await userEvent.click(screen.getByRole("button", { name: "Plan a project" }));
      const sheet = await screen.findByRole("dialog");
      await userEvent.type(
        within(sheet).getByLabelText("What would you like to make?"),
        "A coaster",
      );
      await userEvent.selectOptions(within(sheet).getByLabelText("Craft (optional)"), "s1");
      await userEvent.click(within(sheet).getByRole("button", { name: "Make a plan" }));
    }

    it("asks what to make, shows the plan card, and starts a private project from it", async () => {
      createAIPlan.mockResolvedValue(PLAN);
      createProject.mockResolvedValue({ id: "proj1" });
      renderPanel();

      await planOne();

      const card = await screen.findByRole("article", { name: "Plan: Granny square coaster" });
      expect(createAIPlan).toHaveBeenCalledWith({ text: "A coaster", skillId: "s1" });
      expect(within(card).getByText("Crochet")).toBeInTheDocument();
      expect(
        within(card)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual(["Cotton yarn", "4 mm hook", "1Make a magic ring.", "2Work the first round."]);

      await userEvent.click(within(card).getByRole("button", { name: "Start as my project" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/proj1"));
      expect(createProject).toHaveBeenCalledWith({
        title: "Granny square coaster",
        skillId: "s1",
        visibility: "PRIVATE",
        materials: PLAN.materials,
      });
    });

    it("shows a friendly message when the plan can't be made, and keeps the field usable", async () => {
      createAIPlan.mockRejectedValue(
        new ApiRequestError(503, "AI_UNAVAILABLE", "I couldn't put a plan together. Try again."),
      );
      renderPanel();

      await planOne();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "I couldn't put a plan together. Try again.",
      );
      expect(screen.getByLabelText("Your question")).toBeEnabled();
    });
  });
});
