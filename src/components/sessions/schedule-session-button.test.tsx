import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MessagePerson } from "@/lib/types/messages";

import { ScheduleSessionButton } from "./schedule-session-button";

const api = vi.hoisted(() => ({ listMessagePeople: vi.fn(), push: vi.fn() }));

vi.mock("@/lib/api-client/messages", () => ({ listMessagePeople: api.listMessagePeople }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));

const ravi: MessagePerson = {
  username: "ravi",
  displayName: "Ravi Kumar",
  avatarUrl: null,
  conversationId: null,
};

function renderButton() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ScheduleSessionButton />
    </QueryClientProvider>,
  );
}

describe("ScheduleSessionButton", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it("opens the person picker and then the proposal form for the chosen person", async () => {
    api.listMessagePeople.mockResolvedValue({ items: [ravi], nextCursor: null });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: "Schedule a session" }));
    await user.click(await screen.findByRole("button", { name: /Ravi Kumar/ }));

    expect(api.push).toHaveBeenCalledWith("/community/sessions/new?with=ravi");
  });

  it("shows nothing until it is pressed", () => {
    renderButton();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.listMessagePeople).not.toHaveBeenCalled();
  });
});
