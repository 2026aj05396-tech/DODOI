import "server-only";

import { z } from "zod";

import { DEFAULT_PAGE_SIZE } from "@/lib/constants/pagination";
import { aiPlanSchema } from "@/lib/schemas/ai";
import type {
  AIFeedbackInput,
  AIListQuery,
  ConsentsInput,
  PlanRequestInput,
  SendAIMessageInput,
} from "@/lib/schemas/ai";
import type {
  AIConsents,
  AIContextView,
  AIConversationDetail,
  AIConversationSummary,
  AIMessageView,
  AIPlan,
  CompanionSetup,
  SendAIMessageResult,
} from "@/lib/types/ai";
import type { Paginated } from "@/lib/types/api";
import { db } from "@/server/db/client";
import { aiProvider as defaultProvider } from "@/server/integrations/ai";
import {
  AIProviderError,
  type AIChatMessage,
  type AIContent,
  type AIProvider,
} from "@/server/integrations/ai/types";
import {
  mediaProvider as defaultMediaProvider,
  type MediaProvider,
} from "@/server/integrations/media";
import type { Actor, AuthenticatedActor } from "@/server/lib/actor";
import { serverEnv } from "@/server/lib/env";
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthenticatedError,
  UnprocessableError,
} from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { decodeCursor, encodeCursor } from "@/server/lib/pagination";
import { consumeRateLimit, type RateLimitRule } from "@/server/lib/rate-limit";
import {
  deleteUnusedMedia,
  getMedia,
  getOwnImageForAI,
  getPostDetail,
  getPublishedPostTitles,
} from "@/server/modules/content";
import {
  getActivePredefinedSkills,
  getActiveSkillSummaries,
  getSkillBySlug,
} from "@/server/modules/skills";
import { getProfileSkills } from "@/server/modules/users";

import { buildSystemPrompt, PROMPT_VERSION } from "./prompts/companion";
import { buildPlanSystemPrompt, PLAN_JSON_SCHEMA, wrapPlanRequest } from "./prompts/plan";
import {
  countProviderRequestsSince,
  deleteConversations,
  deleteUsageBefore,
  findActiveConsents,
  findConversation,
  findAnswersByIds,
  findConversations,
  findImageIdsOfConversations,
  findMessageForFeedback,
  findMessages,
  findRecentMessages,
  insertConversationWithMessages,
  insertUsage,
  upsertConsent,
  upsertFeedback,
  type ConversationRow,
  type MessageRow,
} from "./repository";

// The AI companion (P4-01; PRODUCT_REQUIREMENTS AIC-01…09, AI_INTEGRATION). Every call goes
// through the server and the `AIProvider` interface. Order of a message: signed in and verified →
// companion on and under the global cap → context and photo checked (authorization before anything
// enters a prompt) → consent → quotas → provider → store. Logs never hold text or photos.

/** The consent notice's version, stored with each consent (AI_INTEGRATION §7). */
export const CONSENT_POLICY_VERSION = "ai-2026-1";

/** AIC-09 (PO, 2026-10-29): 30 messages a day, 10 a minute, 5 photos a day. */
export const AI_DAILY_LIMIT: RateLimitRule = {
  name: "ai-message",
  limit: 30,
  windowSeconds: 86_400,
};
export const AI_MINUTE_LIMIT: RateLimitRule = {
  name: "ai-message-minute",
  limit: 10,
  windowSeconds: 60,
};
export const AI_PHOTO_LIMIT: RateLimitRule = { name: "ai-photo", limit: 5, windowSeconds: 86_400 };

const MAX_OUTPUT_TOKENS = 800;
const HISTORY_MESSAGES = 10;
const MAX_IMAGE_WIDTH = 1568;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_ANSWER_LENGTH = 8_000;
const RETENTION_DAYS = 30;
const USAGE_RETENTION_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

const RESTING = "The companion is resting. Try again later.";
const BLOCKED_ANSWER = "I can't help with that one.";

const listCursorSchema = z.object({ updatedAt: z.iso.datetime(), id: z.string().min(1).max(40) });

type Options = {
  provider?: AIProvider | null;
  mediaProvider?: MediaProvider;
  /** Fetches a photo's bytes; tests replace it. */
  loadImage?: (url: string) => Promise<{ data: string; bytes: number }>;
  now?: Date;
};

function requireVerified(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  if (!actor.isEmailVerified) {
    throw new ForbiddenError("Verify your email to use the companion.", {
      code: "EMAIL_NOT_VERIFIED",
    });
  }
  return actor;
}

function requireSignedIn(actor: Actor): AuthenticatedActor {
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

function resting(): ServiceUnavailableError {
  return new ServiceUnavailableError(RESTING, { code: "AI_UNAVAILABLE" });
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function defaultLoadImage(url: string): Promise<{ data: string; bytes: number }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("photo not available");
  const buffer = Buffer.from(await response.arrayBuffer());
  return { data: buffer.toString("base64"), bytes: buffer.length };
}

/** What the chat screens render with: on or off, the free-tier notice, consents, skill links. */
export async function getCompanionSetup(
  actor: Actor,
  { provider = defaultProvider }: Pick<Options, "provider"> = {},
): Promise<CompanionSetup> {
  const user = requireSignedIn(actor);
  const [consents, skills] = await Promise.all([getConsents(user), getActivePredefinedSkills()]);
  return {
    isAvailable: provider !== null,
    showFreeTierNotice: serverEnv.AI_TIER === "free",
    consents,
    skills: skills.map(({ id, name, slug }) => ({ id, name, slug })),
  };
}

// --- Consents (AIC-07) ------------------------------------------------------------------------

async function activeConsents(userId: string): Promise<Set<string>> {
  return new Set((await findActiveConsents(userId)).map((row) => row.type));
}

/** GET /api/me/consents. */
export async function getConsents(actor: Actor): Promise<AIConsents> {
  const user = requireSignedIn(actor);
  const active = await activeConsents(user.id);
  return {
    AI_IMAGES: active.has("AI_IMAGES"),
    AI_PROFILE_CONTEXT: active.has("AI_PROFILE_CONTEXT"),
  };
}

/** PUT /api/me/consents: grants or withdraws; withdrawing stops use at once. */
export async function setConsents(
  actor: Actor,
  input: ConsentsInput,
  { now = new Date() }: Options = {},
): Promise<AIConsents> {
  const user = requireSignedIn(actor);
  for (const type of ["AI_IMAGES", "AI_PROFILE_CONTEXT"] as const) {
    const granted = input[type];
    if (granted !== undefined) {
      await upsertConsent(user.id, type, granted, CONSENT_POLICY_VERSION, now);
    }
  }
  return getConsents(user);
}

// --- Context assembly (AI_INTEGRATION §4.2) -----------------------------------------------------

type ContextParts = { label: string; body: string; view: NonNullable<AIContextView> };

const clip = (text: string | null | undefined, max: number) => (text ?? "").slice(0, max);

/** The one post or skill in view, only if the user may see it (404 otherwise). */
async function assembleContext(
  actor: AuthenticatedActor,
  context: { type: "POST" | "SKILL"; id: string },
): Promise<ContextParts> {
  if (context.type === "POST") {
    const post = await getPostDetail(actor, context.id);
    const body = [
      `Title: ${clip(post.title, 120)}`,
      post.description ? `Description: ${clip(post.description, 1_200)}` : null,
      post.difficulty ? `Difficulty: ${post.difficulty}` : null,
      post.materials.length > 0
        ? `Materials: ${post.materials.map((m) => clip(m.name, 60)).join(", ")}`
        : null,
      post.steps.length > 0
        ? `Steps:\n${post.steps.map((s, i) => `${i + 1}. ${clip(s.text, 300)}`).join("\n")}`
        : null,
      post.creator ? `Shared by: ${clip(post.creator.displayName, 60)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      label: "The post the reader is asking about:",
      body,
      view: { type: "POST", id: post.id, title: post.title },
    };
  }
  const [summary] = [...(await getActiveSkillSummaries([context.id])).values()];
  if (!summary) throw new NotFoundError("We couldn't find that skill.");
  const skill = await getSkillBySlug(actor, summary.slug);
  const body = [
    `Skill: ${skill.name}`,
    skill.pitch ? `Pitch: ${clip(skill.pitch, 140)}` : null,
    skill.description ? `About: ${clip(skill.description, 1_200)}` : null,
    skill.hint ? `Where to start: ${clip(skill.hint, 400)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    label: "The skill the reader is asking about:",
    body,
    view: { type: "SKILL", id: skill.id, title: skill.name },
  };
}

/** Interests, levels and want-to-learn skills; only called after the profile-context consent. */
async function describeProfile(userId: string): Promise<string | null> {
  const { interests, wantsToLearn } = await getProfileSkills(userId);
  const line = (items: typeof interests) =>
    items
      .map(({ skill, level }) => (level ? `${skill.name} (${level.toLowerCase()})` : skill.name))
      .join(", ");
  const parts = [
    interests.length > 0 ? `Interests: ${line(interests)}` : null,
    wantsToLearn.length > 0 ? `Wants to learn: ${line(wantsToLearn)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : null;
}

// --- Views --------------------------------------------------------------------------------------

async function resolveContexts(rows: ConversationRow[]): Promise<Map<string, AIContextView>> {
  const postIds = rows.flatMap((r) =>
    r.contextType === "POST" && r.contextId ? [r.contextId] : [],
  );
  const skillIds = rows.flatMap((r) =>
    r.contextType === "SKILL" && r.contextId ? [r.contextId] : [],
  );
  const [posts, skills] = await Promise.all([
    getPublishedPostTitles(postIds),
    getActiveSkillSummaries(skillIds),
  ]);
  return new Map(
    rows.map((row) => {
      let view: AIContextView = null;
      if (row.contextType === "POST" && row.contextId) {
        const title = posts.get(row.contextId);
        if (title) view = { type: "POST", id: row.contextId, title };
      } else if (row.contextType === "SKILL" && row.contextId) {
        const skill = skills.get(row.contextId);
        if (skill) view = { type: "SKILL", id: row.contextId, title: skill.name };
      }
      return [row.id, view];
    }),
  );
}

function toSummary(row: ConversationRow, context: AIContextView): AIConversationSummary {
  return {
    id: row.id,
    title: row.title,
    contextType: row.contextType,
    context,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function toMessageViews(
  rows: MessageRow[],
  mediaProvider: MediaProvider,
): Promise<AIMessageView[]> {
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      image: row.imageMediaId
        ? await getMedia(row.imageMediaId, { provider: mediaProvider })
        : null,
      status: row.status,
      feedback: row.feedback ? { helpful: row.feedback.helpful } : null,
      createdAt: row.createdAt.toISOString(),
    })),
  );
}

// --- Sending a message ----------------------------------------------------------------------------

async function ownConversation(user: AuthenticatedActor, id: string): Promise<ConversationRow> {
  const row = await findConversation(id);
  if (!row || row.userId !== user.id)
    throw new NotFoundError("We couldn't find that conversation.");
  return row;
}

/** Counts the message against the limits; over one of them, throws 429 AI_QUOTA with the reset time. */
async function enforceQuotas(
  user: AuthenticatedActor,
  hasImage: boolean,
  model: string,
  now: Date,
) {
  const rules = [AI_MINUTE_LIMIT, AI_DAILY_LIMIT, ...(hasImage ? [AI_PHOTO_LIMIT] : [])];
  for (const rule of rules) {
    const result = await consumeRateLimit(rule, user.id, { now });
    if (result.allowed) continue;
    await insertUsage({
      userId: user.id,
      model,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
      latencyMs: 0,
      status: "QUOTA",
      hasImage,
    });
    const resetAt = new Date(now.getTime() + result.retryAfterSeconds * 1000).toISOString();
    const message =
      rule === AI_MINUTE_LIMIT
        ? "Slow down a little. Try again in a minute."
        : rule === AI_PHOTO_LIMIT
          ? "You've used today's photos. They reset tomorrow."
          : "You've used today's questions. They reset tomorrow.";
    throw new RateLimitError(result.retryAfterSeconds, message, {
      code: "AI_QUOTA",
      fields: { resetAt },
    });
  }
}

function costMicros(inputTokens: number, outputTokens: number): number {
  return Math.round(
    inputTokens * serverEnv.AI_INPUT_PRICE_PER_M + outputTokens * serverEnv.AI_OUTPUT_PRICE_PER_M,
  );
}

/** POST /api/ai/messages (AIC-01…06). */
export async function sendMessage(
  actor: Actor,
  input: SendAIMessageInput,
  {
    provider = defaultProvider,
    mediaProvider = defaultMediaProvider,
    loadImage = defaultLoadImage,
    now = new Date(),
  }: Options = {},
): Promise<SendAIMessageResult> {
  const user = requireVerified(actor);
  if (!provider) throw resting();
  if ((await countProviderRequestsSince(startOfUtcDay(now))) >= serverEnv.AI_DAILY_REQUEST_CAP) {
    throw resting();
  }

  // Who and what the message is about, checked before anything goes into a prompt.
  const existing = input.conversationId ? await ownConversation(user, input.conversationId) : null;
  const contextInput = existing
    ? existing.contextType !== "NONE" && existing.contextId
      ? { type: existing.contextType, id: existing.contextId }
      : null
    : (input.context ?? null);
  let context: ContextParts | null = null;
  if (contextInput) {
    try {
      context = await assembleContext(user, contextInput);
    } catch (error) {
      // A post that has since gone leaves an old conversation usable, without its context.
      if (!(existing && error instanceof NotFoundError)) throw error;
    }
  }

  // A photo needs consent and must be the user's own image.
  let image: { mimeType: string; data: string } | null = null;
  if (input.imageMediaId) {
    if (!(await activeConsents(user.id)).has("AI_IMAGES")) {
      throw new ForbiddenError("Allow the companion to use your photo first.", {
        code: "AI_CONSENT_REQUIRED",
      });
    }
    const own = await getOwnImageForAI(user.id, input.imageMediaId, {
      width: MAX_IMAGE_WIDTH,
      provider: mediaProvider,
    });
    if (!own) throw new NotFoundError("We couldn't find that photo.");
    try {
      const loaded = await loadImage(own.url);
      if (loaded.bytes > MAX_IMAGE_BYTES) throw new Error("photo too large");
      image = { mimeType: own.mimeType, data: loaded.data };
    } catch {
      throw resting();
    }
  }

  await enforceQuotas(user, image !== null, provider.model, now);

  const [consents, skills, history] = await Promise.all([
    activeConsents(user.id),
    getActivePredefinedSkills(),
    existing ? findRecentMessages(existing.id, HISTORY_MESSAGES) : [],
  ]);
  const profile = consents.has("AI_PROFILE_CONTEXT") ? await describeProfile(user.id) : null;
  const system = buildSystemPrompt({
    context: context ? { label: context.label, body: context.body } : null,
    profile,
    skillNames: skills.map((skill) => skill.name),
  });

  // Earlier photos are not sent again, to keep the cost down.
  const messages: AIChatMessage[] = history.map((message) => ({
    role: message.role === "USER" ? "user" : "assistant",
    content: [
      { type: "text", text: message.imageMediaId ? `[photo] ${message.content}` : message.content },
    ],
  }));
  const content: AIContent[] = [{ type: "text", text: input.text }];
  if (image) content.push({ type: "image", ...image });
  messages.push({ role: "user", content });

  let result;
  try {
    result = await provider.generate({ system, messages, maxOutputTokens: MAX_OUTPUT_TOKENS });
  } catch (error) {
    await insertUsage({
      userId: user.id,
      model: provider.model,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
      latencyMs: 0,
      status: "ERROR",
      hasImage: image !== null,
    });
    // Status only: never the prompt or the provider's body.
    logger.error("AI provider failed", {
      status: error instanceof AIProviderError ? error.status : null,
    });
    throw resting();
  }

  await insertUsage({
    userId: user.id,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costMicros: costMicros(result.inputTokens, result.outputTokens),
    latencyMs: result.latencyMs,
    status: result.kind === "ok" ? "OK" : "BLOCKED",
    hasImage: image !== null,
  });

  const base = {
    conversationId: existing?.id ?? null,
    userId: user.id,
    title: input.text.slice(0, 80),
    contextType: context ? context.view.type : (existing?.contextType ?? "NONE"),
    contextId: context ? context.view.id : (existing?.contextId ?? null),
  } as const;
  const userMessage = {
    role: "USER",
    content: input.text,
    imageMediaId: input.imageMediaId ?? null,
    promptVersion: null,
  } as const;

  if (result.kind === "blocked") {
    // The question is kept, marked blocked, so the user sees it in their history.
    await db.$transaction((tx) =>
      insertConversationWithMessages(tx, {
        ...base,
        messages: [{ ...userMessage, status: "BLOCKED" }],
      }),
    );
    throw new UnprocessableError(BLOCKED_ANSWER, { code: "AI_BLOCKED" });
  }

  const stored = await db.$transaction((tx) =>
    insertConversationWithMessages(tx, {
      ...base,
      messages: [
        { ...userMessage, status: "OK" },
        {
          role: "ASSISTANT",
          content: result.text.slice(0, MAX_ANSWER_LENGTH),
          imageMediaId: null,
          promptVersion: PROMPT_VERSION,
          status: "OK",
        },
      ],
    }),
  );
  const [userView, assistantView] = await toMessageViews(stored.messages, mediaProvider);
  if (!userView || !assistantView) throw new Error("Messages missing");
  const contextView =
    context?.view ??
    (await resolveContexts([stored.conversation])).get(stored.conversation.id) ??
    null;
  return {
    conversation: toSummary(stored.conversation, contextView),
    userMessage: userView,
    assistantMessage: assistantView,
  };
}

/**
 * For reports (P4-02): whether `messageId` is a companion answer in the actor's own conversation.
 * Nobody else's chats can be reported, so no one learns that another person's message exists.
 */
export async function isOwnAnswer(actor: Actor, messageId: string): Promise<boolean> {
  const user = requireSignedIn(actor);
  const row = await findMessageForFeedback(messageId);
  return row !== null && row.role === "ASSISTANT" && row.conversation.userId === user.id;
}

/** For the moderators' reports list: the reported answers' text (and nothing around it). */
export async function getAnswersForModeration(ids: string[]): Promise<Map<string, string>> {
  return new Map((await findAnswersByIds(ids)).map((row) => [row.id, row.content]));
}

// --- Project plans (P4-03, AIC-04) ------------------------------------------------------------------

const PLAN_MAX_OUTPUT_TOKENS = 1_200;
const PLAN_FAILED = "I couldn't put a plan together. Try again.";

function parsePlan(text: string): z.output<typeof aiPlanSchema> | null {
  try {
    const parsed = aiPlanSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/ai/plan: a materials checklist and steps for what the member wants to make. A request
 * like a message (same limits, same global cap); the answer is checked against `aiPlanSchema` and
 * asked for once more when it doesn't fit (AI_INTEGRATION §11). Nothing is stored here: the plan
 * becomes a project only when the member starts it.
 */
export async function createPlan(
  actor: Actor,
  input: PlanRequestInput,
  { provider = defaultProvider, now = new Date() }: Pick<Options, "provider" | "now"> = {},
): Promise<AIPlan> {
  const user = requireVerified(actor);
  if (!provider) throw resting();
  if ((await countProviderRequestsSince(startOfUtcDay(now))) >= serverEnv.AI_DAILY_REQUEST_CAP) {
    throw resting();
  }

  const skills = await getActivePredefinedSkills();
  let chosen: string | null = null;
  if (input.skillId) {
    chosen = (await getActiveSkillSummaries([input.skillId])).get(input.skillId)?.name ?? null;
    if (!chosen) throw new NotFoundError("We couldn't find that skill.");
  }

  await enforceQuotas(user, false, provider.model, now);

  const request = {
    system: buildPlanSystemPrompt(skills.map((skill) => skill.name)),
    messages: [
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: wrapPlanRequest(input.text, chosen) }],
      },
    ],
    maxOutputTokens: PLAN_MAX_OUTPUT_TOKENS,
    jsonSchema: PLAN_JSON_SCHEMA as unknown as Record<string, unknown>,
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let result;
    try {
      result = await provider.generate(request);
    } catch (error) {
      await insertUsage({
        userId: user.id,
        model: provider.model,
        inputTokens: 0,
        outputTokens: 0,
        costMicros: 0,
        latencyMs: 0,
        status: "ERROR",
        hasImage: false,
      });
      logger.error("AI provider failed", {
        status: error instanceof AIProviderError ? error.status : null,
      });
      throw resting();
    }
    await insertUsage({
      userId: user.id,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costMicros: costMicros(result.inputTokens, result.outputTokens),
      latencyMs: result.latencyMs,
      status: result.kind === "ok" ? "OK" : "BLOCKED",
      hasImage: false,
    });
    if (result.kind === "blocked") {
      throw new UnprocessableError(BLOCKED_ANSWER, { code: "AI_BLOCKED" });
    }
    const plan = parsePlan(result.text);
    if (!plan) continue;
    const match = skills.find((skill) => skill.name.toLowerCase() === plan.craft.toLowerCase());
    const skillId = input.skillId ?? match?.id ?? null;
    return {
      title: plan.title,
      craft: chosen ?? match?.name ?? plan.craft,
      skillId,
      materials: plan.materials,
      steps: plan.steps,
    };
  }
  throw new ServiceUnavailableError(PLAN_FAILED, { code: "AI_UNAVAILABLE" });
}

// --- Conversations ----------------------------------------------------------------------------------

/** GET /api/ai/conversations: newest activity first. */
export async function listConversations(
  actor: Actor,
  query: AIListQuery,
): Promise<Paginated<AIConversationSummary>> {
  const user = requireSignedIn(actor);
  const after = query.cursor
    ? (() => {
        const decoded = decodeCursor(query.cursor, listCursorSchema);
        return { updatedAt: new Date(decoded.updatedAt), id: decoded.id };
      })()
    : null;
  const rows = await findConversations(user.id, after, DEFAULT_PAGE_SIZE + 1);
  const page = rows.slice(0, DEFAULT_PAGE_SIZE);
  const last = page.at(-1);
  const contexts = await resolveContexts(page);
  return {
    items: page.map((row) => toSummary(row, contexts.get(row.id) ?? null)),
    nextCursor:
      rows.length > DEFAULT_PAGE_SIZE && last
        ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
        : null,
  };
}

/** GET /api/ai/conversations/{id}: someone else's is a 404. */
export async function getConversation(
  actor: Actor,
  id: string,
  { mediaProvider = defaultMediaProvider }: Options = {},
): Promise<AIConversationDetail> {
  const user = requireSignedIn(actor);
  const row = await ownConversation(user, id);
  const [messages, contexts] = await Promise.all([findMessages(id), resolveContexts([row])]);
  return {
    ...toSummary(row, contexts.get(row.id) ?? null),
    messages: await toMessageViews(messages, mediaProvider),
  };
}

/** Deletes conversations and then their photos (DELETE /api/ai/conversations[/{id}]). */
async function removeConversations(
  where: Parameters<typeof deleteConversations>[0],
  mediaProvider: MediaProvider,
): Promise<number> {
  const imageIds = await findImageIdsOfConversations(where);
  const count = await deleteConversations(where);
  await deleteUnusedMedia(imageIds, { provider: mediaProvider });
  return count;
}

export async function deleteConversation(
  actor: Actor,
  id: string,
  { mediaProvider = defaultMediaProvider }: Options = {},
): Promise<void> {
  const user = requireSignedIn(actor);
  await ownConversation(user, id);
  await removeConversations({ id, userId: user.id }, mediaProvider);
}

export async function deleteAllConversations(
  actor: Actor,
  { mediaProvider = defaultMediaProvider }: Options = {},
): Promise<void> {
  const user = requireSignedIn(actor);
  await removeConversations({ userId: user.id }, mediaProvider);
}

/** PUT /api/ai/messages/{id}/feedback: assistant messages in your own conversations only. */
export async function submitFeedback(
  actor: Actor,
  messageId: string,
  input: AIFeedbackInput,
): Promise<void> {
  const user = requireSignedIn(actor);
  const message = await findMessageForFeedback(messageId);
  if (!message || message.role !== "ASSISTANT" || message.conversation.userId !== user.id) {
    throw new NotFoundError("We couldn't find that answer.");
  }
  await upsertFeedback({
    messageId,
    userId: user.id,
    helpful: input.helpful,
    comment: input.comment || null,
  });
}

// --- Retention (AI_INTEGRATION §10) ------------------------------------------------------------------

/** Daily job: conversations 30 days after their last message, with their photos. */
export async function purgeExpiredConversations({
  now = new Date(),
  mediaProvider = defaultMediaProvider,
}: Options = {}): Promise<number> {
  return removeConversations(
    { updatedAt: { lt: new Date(now.getTime() - RETENTION_DAYS * DAY_MS) } },
    mediaProvider,
  );
}

/** Daily job: usage rows (counts only) older than 12 months. */
export async function purgeOldUsage(now = new Date()): Promise<number> {
  return deleteUsageBefore(new Date(now.getTime() - USAGE_RETENTION_DAYS * DAY_MS));
}
