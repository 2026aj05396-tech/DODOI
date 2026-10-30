import type { NotificationItem } from "@/lib/types/notifications";

import { sessionTimeText } from "./session-time";

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

/** The session's start in the viewer's zone, with IST beside it elsewhere (SES-03). */
function when(item: NotificationItem): string {
  return item.session ? sessionTimeText(item.session.startsAt) : "a date to be confirmed";
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
    case "HELP_RESPONSE":
      return `${who} offered help on ${item.helpRequest?.title ?? "your request"}`;
    case "HELP_HELPFUL":
      return `${who} found your help useful on ${item.helpRequest?.title ?? "a request"}`;
    case "HELP_RESOLVED":
      return `${who} marked ${item.helpRequest?.title ?? "a request"} as resolved`;
    case "SESSION_PROPOSED":
      return `${who} proposed a session on ${when(item)}`;
    case "SESSION_ACCEPTED":
      return `${who} accepted your session on ${when(item)}`;
    case "SESSION_DECLINED":
      return `${who} declined your session on ${when(item)}`;
    case "SESSION_RESCHEDULED":
      return `${who} suggested a new time for your session: ${when(item)}`;
    case "SESSION_CANCELLED":
      return `${who} cancelled the session on ${when(item)}`;
    case "SESSION_REMINDER":
      return `Your session with ${who} starts soon, on ${when(item)}`;
  }
}

/** Where a notification opens: the post (scrolled to the comment) or the new follower's profile. */
export function notificationHref(item: NotificationItem): string | null {
  if (item.type === "FOLLOW") {
    const follower = item.actors[0];
    return follower ? `/u/${follower.username}` : null;
  }
  if (item.session) return "/community/sessions";
  if (item.helpRequest) return `/community/help/${item.helpRequest.id}`;
  if (!item.post) return null;
  const hash = item.commentId ? `#comment-${item.commentId}` : "";
  return `/p/${item.post.id}${hash}`;
}
