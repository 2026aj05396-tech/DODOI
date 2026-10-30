import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HelpRequestDetail } from "@/lib/types/help";

import { HelpRequestView } from "./help-request-view";

const api = vi.hoisted(() => ({
  createHelpResponse: vi.fn(),
  deleteHelpRequest: vi.fn(),
  setHelpRequestStatus: vi.fn(),
  setResponseHelpful: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/api-client/help", () => ({
  createHelpResponse: api.createHelpResponse,
  deleteHelpRequest: api.deleteHelpRequest,
  setHelpRequestStatus: api.setHelpRequestStatus,
  setResponseHelpful: api.setResponseHelpful,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: api.replace, back: vi.fn() }) }));

function request(overrides: Partial<HelpRequestDetail> = {}): HelpRequestDetail {
  return {
    id: "h1",
    title: "Why is my sky blotchy?",
    body: "The wash dries in patches.",
    status: "OPEN",
    skill: { id: "s1", name: "Watercolor", slug: "watercolor", accent: "SKY" },
    author: { username: "ravi", displayName: "Ravi", avatarUrl: null },
    responseCount: 1,
    isOwn: false,
    createdAt: new Date().toISOString(),
    photos: [],
    responses: [
      {
        id: "r1",
        body: "Wet the paper first.",
        author: { username: "tara", displayName: "Tara", avatarUrl: null },
        isOwn: false,
        isHelpful: false,
        createdAt: new Date().toISOString(),
      },
    ],
    canRespond: true,
    isHidden: false,
    ...overrides,
  };
}

describe("HelpRequestView", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it("shows the request to a helper, who can offer help and report it", async () => {
    api.createHelpResponse.mockResolvedValue(
      request({
        responseCount: 2,
        responses: [
          ...request().responses,
          {
            id: "r2",
            body: "Try a flat brush.",
            author: null,
            isOwn: true,
            isHelpful: false,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );
    render(<HelpRequestView initial={request()} isVerified />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Why is my sky blotchy?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More options for this request" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as resolved" })).toBeNull();

    await userEvent.type(screen.getByLabelText("Offer help"), "Try a flat brush.");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(api.createHelpResponse).toHaveBeenCalledWith("h1", { body: "Try a flat brush." });
    expect(await screen.findByText("Try a flat brush.")).toBeInTheDocument();
    expect(screen.getByLabelText("Offer help")).toHaveValue("");
    expect(screen.getByRole("heading", { level: 2, name: "2 replies" })).toBeInTheDocument();
  });

  it("lets the asker mark a response helpful, resolve and reopen the request", async () => {
    api.setResponseHelpful.mockResolvedValue(undefined);
    api.setHelpRequestStatus.mockResolvedValueOnce(
      request({ isOwn: true, status: "RESOLVED", canRespond: false }),
    );
    api.setHelpRequestStatus.mockResolvedValueOnce(
      request({ isOwn: true, status: "OPEN", canRespond: false }),
    );
    render(<HelpRequestView initial={request({ isOwn: true, canRespond: false })} isVerified />);

    expect(screen.queryByLabelText("Offer help")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "This helped" }));
    expect(api.setResponseHelpful).toHaveBeenCalledWith("r1", true);
    expect(screen.getByRole("button", { name: "Marked helpful" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "Mark as resolved" }));
    expect(api.setHelpRequestStatus).toHaveBeenLastCalledWith("h1", "RESOLVED");
    await userEvent.click(await screen.findByRole("button", { name: "Reopen" }));
    expect(api.setHelpRequestStatus).toHaveBeenLastCalledWith("h1", "OPEN");
    expect(await screen.findByRole("button", { name: "Mark as resolved" })).toBeInTheDocument();
  });

  it("puts the helpful mark back when saving fails", async () => {
    api.setResponseHelpful.mockRejectedValue(new Error("nope"));
    render(<HelpRequestView initial={request({ isOwn: true, canRespond: false })} isVerified />);

    await userEvent.click(screen.getByRole("button", { name: "This helped" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "This helped" })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );
  });

  it("explains why a member can't answer: resolved, or an unverified email", () => {
    const { unmount } = render(
      <HelpRequestView initial={request({ status: "RESOLVED", canRespond: false })} isVerified />,
    );
    expect(screen.getByText("This request is resolved.")).toBeInTheDocument();
    unmount();

    render(<HelpRequestView initial={request({ canRespond: false })} isVerified={false} />);
    expect(screen.getByText("Verify your email to offer help.")).toBeInTheDocument();
  });

  it("asks before deleting and goes back to the list", async () => {
    api.deleteHelpRequest.mockResolvedValue(undefined);
    render(<HelpRequestView initial={request({ isOwn: true, canRespond: false })} isVerified />);

    await userEvent.click(screen.getByRole("button", { name: "Delete request" }));
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveTextContent("Delete this request?");
    await userEvent.click(within(sheet).getByRole("button", { name: "Delete request" }));

    await waitFor(() => expect(api.replace).toHaveBeenCalledWith("/community"));
    expect(api.deleteHelpRequest).toHaveBeenCalledWith("h1");
  });

  it("says a hidden request is hidden after a report", () => {
    render(
      <HelpRequestView
        initial={request({ isOwn: true, isHidden: true, canRespond: false })}
        isVerified
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Hidden after a report.");
  });
});
