import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionView } from "@/lib/types/sessions";

import { SessionCard } from "./session-card";

const api = vi.hoisted(() => ({ respondToSession: vi.fn() }));

vi.mock("@/lib/api-client/sessions", () => ({ respondToSession: api.respondToSession }));

function session(overrides: Partial<SessionView> = {}): SessionView {
  return {
    id: "s1",
    state: "PROPOSED",
    isProposer: false,
    other: { username: "ravi", displayName: "Ravi", avatarUrl: null },
    startsAt: "2026-11-03T10:00:00.000Z",
    durationMin: 30,
    note: "Bring your hoop",
    meetingUrl: null,
    helpRequestId: null,
    canRespond: true,
    canCancel: true,
    createdAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("SessionCard", () => {
  beforeEach(() => {
    api.respondToSession.mockReset();
  });

  it("shows who, when, how long, the note and a status with text", () => {
    render(<SessionCard session={session()} onChanged={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Ravi" })).toHaveAttribute("href", "/u/ravi");
    expect(screen.getByText("Proposed to you")).toBeInTheDocument();
    expect(screen.getByText("Proposed")).toBeInTheDocument();
    expect(screen.getByText(/30 min/)).toBeInTheDocument();
    expect(screen.getByText("Bring your hoop")).toBeInTheDocument();
    expect(screen.queryByText(/Join the call/)).not.toBeInTheDocument();
  });

  it("lets the invitee accept, decline or suggest another time, and reloads after an answer", async () => {
    api.respondToSession.mockResolvedValue(session({ state: "ACCEPTED" }));
    const onChanged = vi.fn();
    render(<SessionCard session={session()} onChanged={onChanged} />);
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suggest another time" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(api.respondToSession).toHaveBeenCalledWith("s1", { action: "ACCEPT" });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("tells the proposer they are waiting, with only Cancel to press", () => {
    render(
      <SessionCard
        session={session({ isProposer: true, canRespond: false })}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText("You proposed")).toBeInTheDocument();
    expect(screen.getByText("Waiting for Ravi to answer.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel session" })).toBeInTheDocument();
  });

  it("shows the link only with its warning, opening in a new tab without leaking the opener", () => {
    render(
      <SessionCard
        session={session({
          state: "ACCEPTED",
          canRespond: false,
          meetingUrl: "https://meet.google.com/abc-defg-hij",
        })}
        onChanged={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: /Join the call/ });
    expect(link).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.getByText("Opens another site. Only join if you're comfortable."),
    ).toBeInTheDocument();
  });

  it("asks before cancelling, and offers nothing on a finished session", async () => {
    api.respondToSession.mockResolvedValue(session({ state: "CANCELLED" }));
    const onChanged = vi.fn();
    const { unmount } = render(
      <SessionCard session={session({ canRespond: false })} onChanged={onChanged} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel session" }));
    expect(api.respondToSession).not.toHaveBeenCalled();
    const confirm = screen.getAllByRole("button", { name: "Cancel session" }).at(-1);
    if (!confirm) throw new Error("No confirm button");
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(api.respondToSession).toHaveBeenCalledWith("s1", { action: "CANCEL" }),
    );
    unmount();

    render(
      <SessionCard
        session={session({ state: "COMPLETED", canRespond: false, canCancel: false })}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
