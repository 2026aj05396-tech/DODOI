import { describe, expect, it } from "vitest";

import type { NotificationItem } from "@/lib/types/notifications";

import { notificationHref, notificationText } from "./notification-text";

const person = (displayName: string) => ({
  username: displayName.toLowerCase(),
  displayName,
  avatarUrl: null,
});

function item(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: "n1",
    type: "LIKE",
    actors: [person("Asha")],
    actorCount: 1,
    post: { id: "p1", title: "Cherry blossom hoop" },
    commentId: null,
    isUnread: true,
    createdAt: "2026-10-29T10:00:00.000Z",
    ...overrides,
  };
}

describe("notification text", () => {
  it("names who did what to which post", () => {
    expect(notificationText(item({ type: "COMMENT" }))).toBe(
      "Asha commented on Cherry blossom hoop",
    );
    expect(notificationText(item({ type: "REPLY" }))).toBe(
      "Asha replied to your comment on Cherry blossom hoop",
    );
    expect(notificationText(item({ type: "FOLLOW", post: null }))).toBe("Asha followed you");
  });

  it("groups likes: two names, then 'and n others'", () => {
    const two = item({ actors: [person("Asha"), person("Ravi")], actorCount: 2 });
    expect(notificationText(two)).toBe("Asha and Ravi liked Cherry blossom hoop");
    const four = item({ actors: [person("Ravi"), person("Asha")], actorCount: 4 });
    expect(notificationText(four)).toBe("Ravi and 3 others liked Cherry blossom hoop");
    const three = item({ actors: [person("Ravi"), person("Asha")], actorCount: 3 });
    expect(notificationText(three)).toBe("Ravi and 2 others liked Cherry blossom hoop");
  });

  it("says Someone when the person's profile is gone", () => {
    expect(notificationText(item({ actors: [], actorCount: 1 }))).toBe(
      "Someone liked Cherry blossom hoop",
    );
  });

  it("opens the post, the comment on it, or the follower's profile", () => {
    expect(notificationHref(item({}))).toBe("/p/p1");
    expect(notificationHref(item({ type: "COMMENT", commentId: "c9" }))).toBe("/p/p1#comment-c9");
    expect(notificationHref(item({ type: "FOLLOW", post: null }))).toBe("/u/asha");
    expect(notificationHref(item({ type: "FOLLOW", post: null, actors: [] }))).toBeNull();
  });
});
