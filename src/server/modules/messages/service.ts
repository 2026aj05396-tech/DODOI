import "server-only";

import { z } from "zod";

import { DEFAULT_PAGE_SIZE } from "@/lib/constants/pagination";
import type {
  ConversationListQuery,
  MessagePeopleQuery,
  MessagesQuery,
  SendMessageInput,
  StartConversationInput,
} from "@/lib/schemas/messages";
import type { Paginated } from "@/lib/types/api";
import type {
  ConversationDetail,
  ConversationSummary,
  MessagePage,
  MessagePerson,
  MessageView,
  StartedConversation,
} from "@/lib/types/messages";
import type { CreatorSummary } from "@/lib/types/posts";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableError,
} from "@/server/lib/errors";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { enforceRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";
import { avatarUrl } from "@/server/modules/content";
import {
  getFollowedUserIds,
  getFollowersAmong,
  getFollowerUserIds,
} from "@/server/modules/follows";
import {
  getBlockedUserIds,
  getCreatorProfiles,
  getMessagePolicies,
  getMessagePolicy,
  getPublicCreatorProfiles,
  getUserIdByUsername,
  getUserIdsByUsernames,
  isBlockedEitherWay,
  searchCreators,
} from "@/server/modules/users";

import {
  countMessagesBy,
  countMessagesNotBy,
  eraseMessage,
  findConversationById,
  findConversationByPair,
  findConversationsWithPeers,
  findConversationsFor,
  findLastMessages,
  findLatestFromOthers,
  findMessage,
  findMessages,
  findMessagesBefore,
  findMessagesForModeration,
  insertConversation,
  insertMessage,
  markRead,
  setHidden,
  type ConversationRow,
  type MessagePosition,
  type MessageRow,
} from "./repository";

// Direct messages (P3-02; PRODUCT_REQUIREMENTS MSG-01…05, USER_FLOWS F-29). One-to-one, text only.
// Only the two participants can read a conversation (anyone else gets 404, as does a pair that
// blocked each other: a block ends the conversation). Message text never goes to the logs.

/** MSG-03: 30 messages an hour per member. */
export const MESSAGE_SEND_RATE_LIMIT: RateLimitRule = {
  name: "message-send",
  limit: 30,
  windowSeconds: 60 * 60,
};
/** MSG-03: 5 new conversations a day per member. */
export const CONVERSATION_CREATE_RATE_LIMIT: RateLimitRule = {
  name: "conversation-create",
  limit: 5,
  windowSeconds: 24 * 60 * 60,
};
/** MSG-06: the people search shares the 60 a minute of global search (same bucket name). */
export const MESSAGE_PEOPLE_RATE_LIMIT: RateLimitRule = {
  name: "search-user",
  limit: 60,
  windowSeconds: 60,
};
/** MSG-06: people shown per page, and how far suggestions and one search page look. */
const PEOPLE_PAGE_SIZE = 20;
const SUGGESTION_SOURCE_LIMIT = 200;
const SEARCH_BATCH = 40;
const SEARCH_MAX_BATCHES = 5;
/** MSG-03: until they answer, someone who has never replied gets at most this many messages. */
export const UNANSWERED_MESSAGE_LIMIT = 3;
/** Messages returned at once. */
export const MESSAGE_PAGE_SIZE = 50;
/** The few messages a moderator sees before a reported one (SECURITY §8). */
export const REPORT_CONTEXT_MESSAGES = 5;

const offsetCursorSchema = z.object({ offset: z.number().int().min(0) });
const listCursorSchema = z.object({
  lastMessageAt: z.iso.datetime(),
  id: z.string().min(1).max(40),
});
const messageCursorSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.string().min(1).max(40),
});

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function requireVerified(actor: Actor, action: string): AuthenticatedActor {
  const user = requireSignedIn(actor);
  if (!user.isEmailVerified) {
    throw new ForbiddenError(`Verify your email to ${action}.`, { code: "EMAIL_NOT_VERIFIED" });
  }
  return user;
}

const conversationNotFound = () => new NotFoundError("We couldn't find that conversation.");

function otherOf(conversation: ConversationRow, userId: string): string {
  return conversation.userAId === userId ? conversation.userBId : conversation.userAId;
}

function sideOf(conversation: ConversationRow, userId: string): "A" | "B" {
  return conversation.userAId === userId ? "A" : "B";
}

function creatorSummary(
  profile: { username: string; displayName: string; avatarPublicId: string | null } | undefined,
): CreatorSummary | null {
  return profile
    ? {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarPublicId ? avatarUrl(profile.avatarPublicId) : null,
      }
    : null;
}

function cursorOf(row: { createdAt: Date; id: string }): string {
  return encodeCursor({ createdAt: row.createdAt.toISOString(), id: row.id });
}

function positionOf(cursor: string | undefined): MessagePosition | null {
  if (!cursor) return null;
  const decoded = decodeCursor(cursor, messageCursorSchema);
  return { createdAt: new Date(decoded.createdAt), id: decoded.id };
}

function toMessageView(row: MessageRow, userId: string): MessageView {
  const isDeleted = row.deletedAt !== null;
  return {
    id: row.id,
    body: isDeleted ? null : row.body,
    isOwn: row.senderId === userId,
    isDeleted,
    createdAt: row.createdAt.toISOString(),
    cursor: cursorOf(row),
  };
}

/**
 * MSG-02: whether the recipient's setting lets `senderId` write to them. Someone who has already
 * written in the conversation can always be answered.
 */
async function mayMessage(
  senderId: string,
  recipientId: string,
  conversation: ConversationRow | null,
): Promise<boolean> {
  const policy = (await getMessagePolicy(recipientId)) ?? "EVERYONE";
  if (policy === "EVERYONE") return true;
  if (conversation && (await countMessagesBy(conversation.id, recipientId)) > 0) return true;
  if (policy === "NOBODY") return false;
  return (await getFollowedUserIds(recipientId)).has(senderId);
}

const closed = () =>
  new ForbiddenError("This person isn't taking messages right now.", { code: "MESSAGES_CLOSED" });

/** A conversation the member takes part in and that no block has ended; anything else is 404. */
async function loadConversation(
  user: AuthenticatedActor,
  id: string,
): Promise<{ conversation: ConversationRow; otherId: string }> {
  const conversation = await findConversationById(id);
  if (!conversation || (conversation.userAId !== user.id && conversation.userBId !== user.id)) {
    throw conversationNotFound();
  }
  const otherId = otherOf(conversation, user.id);
  if (await isBlockedEitherWay(user.id, otherId)) throw conversationNotFound();
  return { conversation, otherId };
}

/**
 * Whether the member could write to this person now: used to show or hide "Message" on a profile
 * (F-29 step 1). False for yourself, for anyone either side blocked, and when their setting says no.
 */
export async function canMessage(actor: Actor, recipientId: string): Promise<boolean> {
  const user = requireSignedIn(actor);
  if (recipientId === user.id || (await isBlockedEitherWay(user.id, recipientId))) return false;
  return mayMessage(user.id, recipientId, await findConversationByPair(user.id, recipientId));
}

/** POST /api/conversations: the conversation with a member, existing or new (MSG-01). */
export async function startConversation(
  actor: Actor,
  input: StartConversationInput,
): Promise<StartedConversation> {
  const user = requireVerified(actor, "send messages");
  const recipientId = await getUserIdByUsername(input.username);
  const visible = recipientId ? (await getCreatorProfiles([recipientId])).has(recipientId) : false;
  if (!recipientId || !visible || (await isBlockedEitherWay(user.id, recipientId))) {
    throw new NotFoundError("We couldn't find that person.");
  }
  if (recipientId === user.id) {
    throw new UnprocessableError("You can't message yourself.", { code: "SELF_MESSAGE" });
  }
  const existing = await findConversationByPair(user.id, recipientId);
  if (!(await mayMessage(user.id, recipientId, existing))) throw closed();
  if (existing) {
    await setHidden(existing.id, sideOf(existing, user.id), false);
    return { id: existing.id, created: false };
  }
  await enforceRateLimit(CONVERSATION_CREATE_RATE_LIMIT, user.id);
  return { id: (await insertConversation(user.id, recipientId)).id, created: true };
}

/** GET /api/conversations: newest activity first, with an unread flag (MSG-01). */
export async function listConversations(
  actor: Actor,
  query: ConversationListQuery,
): Promise<Paginated<ConversationSummary>> {
  const user = requireSignedIn(actor);
  const cursor = query.cursor ? decodeCursor(query.cursor, listCursorSchema) : null;
  const rows = await findConversationsFor({
    userId: user.id,
    after: cursor ? { lastMessageAt: new Date(cursor.lastMessageAt), id: cursor.id } : null,
    take: DEFAULT_PAGE_SIZE + 1,
  });
  const page = rows.slice(0, DEFAULT_PAGE_SIZE);
  const ids = page.map((row) => row.id);
  const [last, fromOthers, profiles, blockedFlags] = await Promise.all([
    findLastMessages(ids),
    findLatestFromOthers(ids, user.id),
    getCreatorProfiles(page.map((row) => otherOf(row, user.id))),
    Promise.all(page.map((row) => isBlockedEitherWay(user.id, otherOf(row, user.id)))),
  ]);
  const lastBy = new Map(last.map((message) => [message.conversationId, message]));
  const fromOtherBy = new Map(fromOthers.map((message) => [message.conversationId, message]));

  const items = page.flatMap((row, index): ConversationSummary[] => {
    // A block ends the conversation for both: it leaves the list.
    if (blockedFlags[index]) return [];
    const message = lastBy.get(row.id);
    const readAt = sideOf(row, user.id) === "A" ? row.lastReadAtA : row.lastReadAtB;
    const incoming = fromOtherBy.get(row.id);
    return [
      {
        id: row.id,
        with: creatorSummary(profiles.get(otherOf(row, user.id))),
        lastMessage: message
          ? {
              body: message.deletedAt ? null : message.body,
              isOwn: message.senderId === user.id,
              createdAt: message.createdAt.toISOString(),
            }
          : null,
        lastMessageAt: row.lastMessageAt.toISOString(),
        hasUnread: Boolean(incoming && (!readAt || incoming.createdAt > readAt)),
      },
    ];
  });
  const lastRow = page.at(-1);
  return {
    items,
    nextCursor:
      rows.length > DEFAULT_PAGE_SIZE && lastRow
        ? encodeCursor({ lastMessageAt: lastRow.lastMessageAt.toISOString(), id: lastRow.id })
        : null,
  };
}

/** GET /api/conversations/{id}: the person, whether you can write, and the latest messages. */
export async function getConversation(actor: Actor, id: string): Promise<ConversationDetail> {
  const user = requireSignedIn(actor);
  const { conversation, otherId } = await loadConversation(user, id);
  const [profiles, canSend, page] = await Promise.all([
    getCreatorProfiles([otherId]),
    mayMessage(user.id, otherId, conversation),
    getMessagesPage(user, conversation, {}),
  ]);
  return {
    id: conversation.id,
    with: creatorSummary(profiles.get(otherId)),
    canSend,
    messages: page.items,
    olderCursor: page.olderCursor,
  };
}

async function getMessagesPage(
  user: AuthenticatedActor,
  conversation: ConversationRow,
  query: MessagesQuery,
): Promise<MessagePage> {
  const after = positionOf(query.after);
  const before = positionOf(query.before);
  const rows = await findMessages({
    conversationId: conversation.id,
    after,
    before,
    take: MESSAGE_PAGE_SIZE + 1,
  });
  // Latest or earlier pages come oldest first with one extra row at the start when more exist.
  const hasOlder = !after && rows.length > MESSAGE_PAGE_SIZE;
  const items = (hasOlder ? rows.slice(1) : rows.slice(0, MESSAGE_PAGE_SIZE)).map((row) =>
    toMessageView(row, user.id),
  );
  // Opening or polling a conversation marks it read for this member only (no receipts).
  await markRead(conversation.id, sideOf(conversation, user.id));
  return { items, olderCursor: hasOlder && items[0] ? items[0].cursor : null };
}

/** GET /api/conversations/{id}/messages (polling): latest, `after` a cursor, or `before` one. */
export async function listMessages(
  actor: Actor,
  id: string,
  query: MessagesQuery,
): Promise<MessagePage> {
  const user = requireSignedIn(actor);
  const { conversation } = await loadConversation(user, id);
  return getMessagesPage(user, conversation, query);
}

/** POST /api/conversations/{id}/messages (MSG-01, MSG-02, MSG-03). */
export async function sendMessage(
  actor: Actor,
  id: string,
  input: SendMessageInput,
): Promise<MessageView> {
  const user = requireVerified(actor, "send messages");
  const { conversation, otherId } = await loadConversation(user, id);
  if (!(await mayMessage(user.id, otherId, conversation))) throw closed();
  if (
    (await countMessagesNotBy(conversation.id, user.id)) === 0 &&
    (await countMessagesBy(conversation.id, user.id)) >= UNANSWERED_MESSAGE_LIMIT
  ) {
    throw new UnprocessableError("Wait for them to reply before you send more.", {
      code: "AWAITING_REPLY",
    });
  }
  await enforceRateLimit(MESSAGE_SEND_RATE_LIMIT, user.id);
  const row = await insertMessage({
    conversationId: conversation.id,
    senderId: user.id,
    body: input.body,
  });
  return toMessageView(row, user.id);
}

/** DELETE /api/messages/{id}: the sender erases the text; it then reads "Message deleted" (MSG-04). */
export async function deleteMessage(actor: Actor, id: string): Promise<void> {
  const user = requireSignedIn(actor);
  const row = await findMessage(id);
  if (!row || row.senderId !== user.id) throw new NotFoundError("We couldn't find that message.");
  await loadConversation(user, row.conversationId);
  if (!row.deletedAt) await eraseMessage(id);
}

/** DELETE /api/conversations/{id}: hides it for the member; the other side keeps it (MSG-04). */
export async function hideConversation(actor: Actor, id: string): Promise<void> {
  const user = requireSignedIn(actor);
  const { conversation } = await loadConversation(user, id);
  await setHidden(conversation.id, sideOf(conversation, user.id), true);
}

// --- For reports (MSG-05) ----------------------------------------------------------------------------

/**
 * Whether `actor` may report this message: it is in a conversation they take part in, written by
 * the other person and not deleted. Returns what the report stores.
 */
export async function getReportableMessage(
  actor: Actor,
  id: string,
): Promise<{ id: string; authorId: string } | null> {
  const user = requireSignedIn(actor);
  const row = await findMessage(id);
  if (!row || row.deletedAt) return null;
  const conversation = await findConversationById(row.conversationId);
  if (!conversation || (conversation.userAId !== user.id && conversation.userBId !== user.id)) {
    return null;
  }
  return { id: row.id, authorId: row.senderId };
}

export type ModerationMessage = {
  /** Start of the reported message; null when it was deleted. */
  label: string | null;
  /**
   * The reported message and up to 5 before it, oldest first. `fromSender` is true for lines by
   * the person who wrote the reported one; nobody is named (the reporter stays unknown, RPT-05).
   */
  thread: { text: string; isReported: boolean; fromSender: boolean }[];
};

/** A moderator's view of reported messages: only these lines, never the rest of the conversation. */
export async function getMessagesForModeration(
  ids: string[],
): Promise<Map<string, ModerationMessage>> {
  const result = new Map<string, ModerationMessage>();
  for (const row of await findMessagesForModeration(ids)) {
    const before = row.deletedAt ? [] : await findMessagesBefore(row, REPORT_CONTEXT_MESSAGES);
    const lines = [...before.reverse(), row].map((line) => ({
      text: line.deletedAt ? "Message deleted" : line.body,
      isReported: line.id === row.id,
      fromSender: line.senderId === row.senderId,
    }));
    result.set(row.id, {
      label: row.deletedAt ? null : row.body.slice(0, 140),
      thread: lines,
    });
  }
  return result;
}

type Candidate = {
  userId: string;
  username: string;
  displayName: string;
  avatarPublicId: string | null;
};

/**
 * MSG-06: keeps the candidates the member could start or continue a conversation with. It mirrors
 * `canMessage` for many people at once: not yourself, no block either way, and the person's
 * setting (someone who already wrote in your conversation always counts). Order is kept.
 */
async function keepMessageable(
  user: AuthenticatedActor,
  candidates: Candidate[],
): Promise<MessagePerson[]> {
  const ids = candidates.map((candidate) => candidate.userId);
  const [blocked, policies, conversations, followingMe] = await Promise.all([
    getBlockedUserIds(user.id),
    getMessagePolicies(ids),
    findConversationsWithPeers(user.id, ids),
    getFollowersAmong(user.id, ids),
  ]);
  const people: MessagePerson[] = [];
  for (const candidate of candidates) {
    const id = candidate.userId;
    if (id === user.id || blocked.has(id)) continue;
    const conversation = conversations.get(id);
    const policy = policies.get(id) ?? "EVERYONE";
    const open =
      policy === "EVERYONE" ||
      conversation?.peerHasWritten === true ||
      (policy === "FOLLOWING" && followingMe.has(id));
    if (!open) continue;
    people.push({
      username: candidate.username,
      displayName: candidate.displayName,
      avatarUrl: candidate.avatarPublicId ? avatarUrl(candidate.avatarPublicId) : null,
      conversationId: conversation?.id ?? null,
    });
  }
  return people;
}

/** Before anything is typed: people you follow and people who follow you, by name (MSG-06). */
async function suggestPeople(
  user: AuthenticatedActor,
  offset: number,
): Promise<Paginated<MessagePerson>> {
  const [following, followers] = await Promise.all([
    getFollowedUserIds(user.id),
    getFollowerUserIds(user.id, SUGGESTION_SOURCE_LIMIT),
  ]);
  const ids = [...new Set([...following].slice(0, SUGGESTION_SOURCE_LIMIT).concat(followers))];
  const profiles = await getPublicCreatorProfiles(ids);
  const candidates = [...profiles]
    .map(([userId, profile]) => ({ userId, ...profile }))
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }) ||
        a.username.localeCompare(b.username),
    );
  const people = await keepMessageable(user, candidates);
  const items = people.slice(offset, offset + PEOPLE_PAGE_SIZE);
  const more = people.length > offset + PEOPLE_PAGE_SIZE;
  return { items, nextCursor: more ? encodeCursor({ offset: offset + PEOPLE_PAGE_SIZE }) : null };
}

/**
 * Searching: global search matching (username or a word of the display name, typo tolerant), which
 * only finds public profiles. Members who fail the rules are dropped, so a page is read in batches
 * until it is full; the cursor is the position in the match list after the last one shown.
 */
async function searchPeople(
  user: AuthenticatedActor,
  term: string,
  offset: number,
): Promise<Paginated<MessagePerson>> {
  const found: { person: MessagePerson; next: number }[] = [];
  let position = offset;
  for (let round = 0; round < SEARCH_MAX_BATCHES && found.length <= PEOPLE_PAGE_SIZE; round += 1) {
    const rows = await searchCreators(term, { offset: position, take: SEARCH_BATCH });
    const ids = await getUserIdsByUsernames(rows.map((row) => row.username));
    const candidates = rows.flatMap((row) => {
      const userId = ids.get(row.username);
      return userId ? [{ userId, ...row }] : [];
    });
    const kept = new Map(
      (await keepMessageable(user, candidates)).map((person) => [person.username, person]),
    );
    rows.forEach((row, index) => {
      const person = kept.get(row.username);
      if (person) found.push({ person, next: position + index + 1 });
    });
    position += rows.length;
    if (rows.length < SEARCH_BATCH) break;
  }
  const shown = found.slice(0, PEOPLE_PAGE_SIZE);
  const last = shown.at(-1);
  return {
    items: shown.map((entry) => entry.person),
    nextCursor:
      last && found.length > PEOPLE_PAGE_SIZE ? encodeCursor({ offset: last.next }) : null,
  };
}

/**
 * GET /api/conversations/people: the members you can message now (MSG-06). Never says why someone
 * is missing, and without a search only your follows and followers are offered, so it can't be used
 * to list every member.
 */
export async function listMessagePeople(
  actor: Actor,
  query: MessagePeopleQuery,
): Promise<Paginated<MessagePerson>> {
  const user = requireVerified(actor, "send messages");
  await enforceRateLimit(MESSAGE_PEOPLE_RATE_LIMIT, user.id);
  const offset = query.cursor ? decodeCursor(query.cursor, offsetCursorSchema).offset : 0;
  return query.q ? searchPeople(user, query.q.toLowerCase(), offset) : suggestPeople(user, offset);
}
