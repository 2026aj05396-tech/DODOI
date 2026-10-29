import type { NotificationItem } from "@/lib/types/notifications";

// The sentence and link of a notification (F-21 step 1): "Asha commented on Cherry blossom hoop",
// "Ravi and 3 others liked …", "Meera followed you". A person whose profile is gone is "Someone".

function names(item: NotificationItem): string {
  const [first, second] = item.actors;
  if (!first) return item.actorCount > 1 ? `${item.actorCount} people` : "Someone";
  const others = item.actorCount - item.actors.length;
  if (item.actorCount === 1) return first.displayName;
  if (others <= 0 && second) return `${first.displayName} and ${second.displayName}`;
  const rest = item.actorCount - 1;
  return `${first.displayName} and ${rest} ${rest === 1 ? "other" : "others"}`;
}

export function notificationText(item: NotificationItem): string {
  const who = names(item);
  const title = item.post?.title ?? "your post";
  switch (item.type) {
    case "COMMENT":
      return `${who} commented on ${title}`;
    case "REPLY":
      return `${who} replied to your comment on ${title}`;
    case "LIKE":
      return `${who} liked ${title}`;
    case "FOLLOW":
      return `${who} followed you`;
  }
}

/** Where a notification opens: the post (scrolled to the comment) or the new follower's profile. */
export function notificationHref(item: NotificationItem): string | null {
  if (item.type === "FOLLOW") {
    const follower = item.actors[0];
    return follower ? `/u/${follower.username}` : null;
  }
  if (!item.post) return null;
  const hash = item.commentId ? `#comment-${item.commentId}` : "";
  return `/p/${item.post.id}${hash}`;
}
