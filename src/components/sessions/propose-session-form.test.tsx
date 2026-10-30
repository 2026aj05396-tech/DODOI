import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api-client/request";

import { ProposeSessionForm } from "./propose-session-form";

const api = vi.hoisted(() => ({ proposeSession: vi.fn(), push: vi.fn() }));

vi.mock("@/lib/api-client/sessions", () => ({ proposeSession: api.proposeSession }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));

const INVITEE = { username: "ravi", displayName: "Ravi" };

async function fill(date = "2030-11-03", time = "16:00") {
  await userEvent.type(screen.getByLabelText("Date"), date);
  await userEvent.type(screen.getByLabelText("Time"), time);
}

describe("ProposeSessionForm", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it("asks for the missing time and link and sends nothing", async () => {
    render(<ProposeSessionForm invitee={INVITEE} isVerified />);

    await userEvent.click(screen.getByRole("button", { name: "Send proposal" }));

    expect(screen.getByText("Choose a date and time.")).toBeInTheDocument();
    expect(screen.getByText("Add the meeting link.")).toBeInTheDocument();
    expect(api.proposeSession).not.toHaveBeenCalled();
  });

  it("sends the time as an instant with the length, link and note, then opens Sessions", async () => {
    api.proposeSession.mockResolvedValue({ id: "s1" });
    render(<ProposeSessionForm invitee={INVITEE} helpRequestId="h1" isVerified />);

    await fill();
    await userEvent.selectOptions(screen.getByLabelText("Length"), "45");
    await userEvent.type(screen.getByLabelText("Meeting link"), " https://meet.google.com/abc ");
    await userEvent.type(screen.getByLabelText("Note (optional)"), "Hoop tips");
    await userEvent.click(screen.getByRole("button", { name: "Send proposal" }));

    await waitFor(() =>
      expect(api.proposeSession).toHaveBeenCalledWith({
        inviteeUsername: "ravi",
        startsAt: new Date("2030-11-03T16:00").toISOString(),
        durationMin: 45,
        meetingUrl: "https://meet.google.com/abc",
        note: "Hoop tips",
        helpRequestId: "h1",
      }),
    );
    await waitFor(() => expect(api.push).toHaveBeenCalledWith("/community/sessions"));
  });

  it("shows the server's reasons next to the fields", async () => {
    api.proposeSession.mockRejectedValue(
      new ApiRequestError(400, "TOO_SOON", "Please check what you entered.", {
        startsAt: "Choose a time at least an hour from now.",
      }),
    );
    render(<ProposeSessionForm invitee={INVITEE} isVerified />);

    await fill();
    await userEvent.type(screen.getByLabelText("Meeting link"), "https://meet.google.com/abc");
    await userEvent.click(screen.getByRole("button", { name: "Send proposal" }));

    expect(await screen.findByText("Choose a time at least an hour from now.")).toBeInTheDocument();
    expect(api.push).not.toHaveBeenCalled();
  });

  it("keeps unverified members from sending", () => {
    render(<ProposeSessionForm invitee={INVITEE} isVerified={false} />);

    expect(screen.getByText(/Verify your email to propose a session/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send proposal" })).toBeDisabled();
  });
});
