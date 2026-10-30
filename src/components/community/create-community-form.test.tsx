import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api-client/request";

import { CreateCommunityForm } from "./create-community-form";

const api = vi.hoisted(() => ({ createCommunity: vi.fn(), push: vi.fn() }));

vi.mock("@/lib/api-client/communities", () => ({ createCommunity: api.createCommunity }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));

const SKILLS = [
  { id: "s1", name: "Watercolor" },
  { id: "s2", name: "Crochet" },
];

describe("CreateCommunityForm", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it("asks for the missing parts and sends nothing", async () => {
    render(<CreateCommunityForm skills={SKILLS} isVerified />);

    await userEvent.click(screen.getByRole("button", { name: "Start community" }));

    expect(screen.getByText("Use at least 3 characters for the name.")).toBeInTheDocument();
    expect(screen.getByText("Choose the craft this community is about.")).toBeInTheDocument();
    expect(screen.getByText("Say what this community is about.")).toBeInTheDocument();
    expect(api.createCommunity).not.toHaveBeenCalled();
  });

  it("sends the name, craft, description and non-empty rules, then opens the community", async () => {
    api.createCommunity.mockResolvedValue({ slug: "washes" });
    render(<CreateCommunityForm skills={SKILLS} isVerified />);

    await userEvent.type(screen.getByLabelText("Name"), " Washes ");
    await userEvent.selectOptions(screen.getByLabelText("Craft"), "s1");
    await userEvent.type(screen.getByLabelText("What is it about?"), "Skies and happy accidents.");
    await userEvent.click(screen.getByRole("button", { name: "Add a rule" }));
    await userEvent.type(screen.getByLabelText("Rule 1"), "Be kind");
    await userEvent.click(screen.getByRole("button", { name: "Add a rule" }));
    await userEvent.click(screen.getByRole("button", { name: "Start community" }));

    await waitFor(() =>
      expect(api.createCommunity).toHaveBeenCalledWith({
        name: "Washes",
        skillId: "s1",
        description: "Skies and happy accidents.",
        rules: ["Be kind"],
      }),
    );
    await waitFor(() => expect(api.push).toHaveBeenCalledWith("/community/circles/washes"));
  });

  it("limits rules to five and shows a taken name on the field", async () => {
    api.createCommunity.mockRejectedValue(
      new ApiRequestError(422, "NAME_TAKEN", "A community with that name already exists.", {
        name: "A community with that name already exists.",
      }),
    );
    render(<CreateCommunityForm skills={SKILLS} isVerified />);
    for (let i = 0; i < 5; i += 1) {
      await userEvent.click(screen.getByRole("button", { name: "Add a rule" }));
    }
    expect(screen.queryByRole("button", { name: "Add a rule" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Name"), "Washes");
    await userEvent.selectOptions(screen.getByLabelText("Craft"), "s1");
    await userEvent.type(screen.getByLabelText("What is it about?"), "Skies.");
    await userEvent.click(screen.getByRole("button", { name: "Start community" }));

    expect(
      (await screen.findAllByText("A community with that name already exists.")).length,
    ).toBeGreaterThan(0);
    expect(api.push).not.toHaveBeenCalled();
  });

  it("keeps unverified members from starting one", () => {
    render(<CreateCommunityForm skills={SKILLS} isVerified={false} />);

    expect(screen.getByText(/Verify your email to start a community/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start community" })).toBeDisabled();
  });
});
