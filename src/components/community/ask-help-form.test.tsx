import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/lib/api-client/request";

import { AskHelpForm } from "./ask-help-form";

const api = vi.hoisted(() => ({
  createHelpRequest: vi.fn(),
  uploadMedia: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/api-client/help", () => ({ createHelpRequest: api.createHelpRequest }));
vi.mock("@/lib/api-client/media", () => ({ uploadMedia: api.uploadMedia }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));

const SKILLS = [
  { id: "s1", name: "Watercolor" },
  { id: "s2", name: "Crochet" },
];

function renderForm(props: Partial<React.ComponentProps<typeof AskHelpForm>> = {}) {
  return render(
    <AskHelpForm
      skills={SKILLS}
      isVerified
      initial={{ title: "", body: "", skillId: "" }}
      {...props}
    />,
  );
}

function photo(id: string) {
  return {
    id,
    url: `https://img/${id}`,
    srcSet: "",
    altText: null,
    width: 100,
    height: 100,
    type: "IMAGE",
  };
}

describe("AskHelpForm", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it("asks for the missing parts and sends nothing", async () => {
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Post request" }));

    expect(screen.getByText("Give your question a short title.")).toBeInTheDocument();
    expect(screen.getByText("Choose the craft this is about.")).toBeInTheDocument();
    expect(screen.getByText("Tell makers what you need help with.")).toBeInTheDocument();
    expect(api.createHelpRequest).not.toHaveBeenCalled();
  });

  it("posts the request with its craft and photos, then opens it", async () => {
    api.uploadMedia.mockResolvedValue(photo("m1"));
    api.createHelpRequest.mockResolvedValue({ id: "h9" });
    renderForm();

    await userEvent.type(screen.getByLabelText("Title"), " Blotchy sky ");
    await userEvent.selectOptions(screen.getByLabelText("Craft"), "s1");
    await userEvent.type(
      screen.getByLabelText("What do you need help with?"),
      "It dries in patches.",
    );
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("No file input");
    await userEvent.upload(input, new File(["x"], "sky.jpg", { type: "image/jpeg" }));
    await screen.findByRole("button", { name: "Remove photo 1" });
    await userEvent.click(screen.getByRole("button", { name: "Post request" }));

    await waitFor(() => expect(api.push).toHaveBeenCalledWith("/community/help/h9"));
    expect(api.uploadMedia).toHaveBeenCalledWith(expect.any(File), { purpose: "help" });
    expect(api.createHelpRequest).toHaveBeenCalledWith({
      title: "Blotchy sky",
      body: "It dries in patches.",
      skillId: "s1",
      mediaIds: ["m1"],
    });
  });

  it("starts with the question from the AI chat and stops at three photos", async () => {
    api.uploadMedia
      .mockResolvedValueOnce(photo("m1"))
      .mockResolvedValueOnce(photo("m2"))
      .mockResolvedValueOnce(photo("m3"));
    renderForm({ initial: { title: "How do I start?", body: "How do I start?", skillId: "s2" } });
    expect(screen.getByLabelText("Title")).toHaveValue("How do I start?");
    expect(screen.getByLabelText("Craft")).toHaveValue("s2");

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("No file input");
    for (let i = 0; i < 3; i += 1) {
      await userEvent.upload(input, new File(["x"], `p${i}.jpg`, { type: "image/jpeg" }));
      await screen.findByRole("button", { name: `Remove photo ${i + 1}` });
    }
    expect(screen.queryByRole("button", { name: "Add a photo" })).toBeNull();
  });

  it("shows the server's message when posting fails, and is disabled until verified", async () => {
    api.createHelpRequest.mockRejectedValue(
      new ApiRequestError(429, "RATE_LIMITED", "You've asked a lot today. Try again tomorrow."),
    );
    renderForm({ initial: { title: "T", body: "B", skillId: "s1" } });
    await userEvent.click(screen.getByRole("button", { name: "Post request" }));
    expect(
      await screen.findByText("You've asked a lot today. Try again tomorrow."),
    ).toBeInTheDocument();
  });

  it("tells an unverified member to verify first", () => {
    renderForm({ isVerified: false });

    expect(screen.getByRole("status")).toHaveTextContent("Verify your email to ask for help.");
    expect(screen.getByRole("button", { name: "Post request" })).toBeDisabled();
  });
});
