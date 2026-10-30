import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommunityDetail, CommunityPostView, CommunityThread } from "@/lib/types/communities";

import { CommunityView } from "./community-view";

const api = vi.hoisted(() => ({
  createCommunityPost: vi.fn(),
  deleteCommunity: vi.fn(),
  getCommunity: vi.fn(),
  joinCommunity: vi.fn(),
  leaveCommunity: vi.fn(),
  listCommunityPosts: vi.fn(),
  moderateCommunity: vi.fn(),
  updateCommunityPost: vi.fn(),
  deleteCommunityPost: vi.fn(),
  getCommunityManageView: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/api-client/communities", () => ({
  createCommunityPost: api.createCommunityPost,
  deleteCommunity: api.deleteCommunity,
  getCommunity: api.getCommunity,
  joinCommunity: api.joinCommunity,
  leaveCommunity: api.leaveCommunity,
  listCommunityPosts: api.listCommunityPosts,
  moderateCommunity: api.moderateCommunity,
  updateCommunityPost: api.updateCommunityPost,
  deleteCommunityPost: api.deleteCommunityPost,
  getCommunityManageView: api.getCommunityManageView,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: api.replace, back: vi.fn() }) }));

function community(overrides: Partial<CommunityDetail> = {}): CommunityDetail {
  return {
    id: "c1",
    name: "Watercolor Corner",
    slug: "watercolor-corner",
    description: "Washes and skies.",
    skill: { id: "s1", name: "Watercolor", slug: "watercolor", accent: "SKY" },
    myRole: "MEMBER",
    rules: ["Be kind"],
    isRemoved: false,
    canJoin: false,
    canPost: true,
    ...overrides,
  };
}

function post(overrides: Partial<CommunityPostView> = {}): CommunityPostView {
  return {
    id: "p1",
    body: "How do you stop blooms?",
    author: { username: "ravi", displayName: "Ravi", avatarUrl: null },
    isOwn: false,
    photos: [],
    isHidden: false,
    canEdit: false,
    canDelete: false,
    isEdited: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function thread(overrides: Partial<CommunityThread> = {}): CommunityThread {
  return { ...post(), replies: [], ...overrides };
}

function renderView(detail: CommunityDetail, threads: CommunityThread[] = [], isVerified = true) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CommunityView
        initialCommunity={detail}
        initialPosts={{ items: threads, nextCursor: null }}
        isVerified={isVerified}
      />
    </QueryClientProvider>,
  );
}

describe("CommunityView", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it("lets a visitor join, then shows the role and the composer", async () => {
    api.joinCommunity.mockResolvedValue(undefined);
    api.getCommunity.mockResolvedValue(community());
    renderView(community({ myRole: null, canJoin: true, canPost: false }));
    expect(screen.queryByLabelText("Start a discussion")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(api.joinCommunity).toHaveBeenCalledWith("watercolor-corner");
    expect(await screen.findByText("Joined")).toBeInTheDocument();
    expect(screen.getByLabelText("Start a discussion")).toBeInTheDocument();
  });

  it("explains a removal and offers no Join, and asks unverified visitors to verify", () => {
    const { unmount } = renderView(
      community({ myRole: null, isRemoved: true, canJoin: false, canPost: false }),
    );
    expect(screen.getByText(/You were removed from this community/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join" })).not.toBeInTheDocument();
    unmount();

    renderView(community({ myRole: null, canJoin: false, canPost: false }), [], false);
    expect(screen.getByText("Verify your email to join and post.")).toBeInTheDocument();
  });

  it("shows the rules, and posts a discussion at the top of the list", async () => {
    api.createCommunityPost.mockResolvedValue(post({ id: "p2", body: "Fresh idea", isOwn: true }));
    renderView(community(), [thread()]);
    expect(screen.getByText("Community rules (1)")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Start a discussion"), " Fresh idea ");
    await userEvent.click(screen.getByRole("button", { name: "Post" }));

    expect(api.createCommunityPost).toHaveBeenCalledWith("watercolor-corner", {
      body: "Fresh idea",
      mediaIds: [],
    });
    const items = await screen.findAllByRole("article");
    expect(within(items[0] as HTMLElement).getByText("Fresh idea")).toBeInTheDocument();
    expect(screen.getByLabelText("Start a discussion")).toHaveValue("");
  });

  it("adds a reply under its discussion", async () => {
    api.createCommunityPost.mockResolvedValue(
      post({ id: "r1", body: "One pass of water.", isOwn: true }),
    );
    renderView(community(), [thread()]);

    await userEvent.click(screen.getByRole("button", { name: "Reply" }));
    await userEvent.type(screen.getByLabelText("Your reply"), "One pass of water.");
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));

    expect(api.createCommunityPost).toHaveBeenCalledWith("watercolor-corner", {
      body: "One pass of water.",
      parentId: "p1",
    });
    const replies = await screen.findByRole("list", { name: "Replies" });
    expect(within(replies).getByText("One pass of water.")).toBeInTheDocument();
  });

  it("offers each role only what it may do", async () => {
    const { unmount } = renderView(community({ myRole: "MEMBER" }));
    await userEvent.click(screen.getByRole("button", { name: "More options for this community" }));
    expect(screen.getByRole("menuitem", { name: "Leave community" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Report community" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Manage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete community" })).not.toBeInTheDocument();
    unmount();

    renderView(community({ myRole: "OWNER" }));
    await userEvent.click(screen.getByRole("button", { name: "More options for this community" }));
    expect(screen.getByRole("menuitem", { name: "Manage" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete community" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Leave community" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Report community" })).not.toBeInTheDocument();
  });

  it("lets moderators hide a post and the author edit it", async () => {
    api.moderateCommunity.mockResolvedValue(undefined);
    api.updateCommunityPost.mockResolvedValue(
      post({ id: "p1", body: "Edited", isOwn: true, isEdited: true }),
    );
    renderView(community({ myRole: "MODERATOR" }), [
      thread({ canDelete: true }),
      thread({ id: "p9", body: "Mine", isOwn: true, canEdit: true, canDelete: true }),
    ]);

    const [first, second] = screen.getAllByRole("article");
    await userEvent.click(
      within(first as HTMLElement).getByRole("button", { name: "More options for this post" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Hide post" }));
    expect(api.moderateCommunity).toHaveBeenCalledWith("watercolor-corner", {
      action: "HIDE_POST",
      targetId: "p1",
    });
    expect(await screen.findByText("Only moderators can see this post.")).toBeInTheDocument();

    await userEvent.click(
      within(second as HTMLElement).getByRole("button", { name: "More options for this post" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit post" }));
    const field = screen.getByLabelText("Edit your post");
    await userEvent.clear(field);
    await userEvent.type(field, "Edited");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.updateCommunityPost).toHaveBeenCalledWith("p9", "Edited"));
  });

  it("deletes the community after a confirmation and returns to the circles", async () => {
    api.deleteCommunity.mockResolvedValue(undefined);
    renderView(community({ myRole: "OWNER" }));

    await userEvent.click(screen.getByRole("button", { name: "More options for this community" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete community" }));
    expect(api.deleteCommunity).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete community" }));

    await waitFor(() => expect(api.replace).toHaveBeenCalledWith("/community/circles"));
    expect(api.deleteCommunity).toHaveBeenCalledWith("watercolor-corner");
  });
});
