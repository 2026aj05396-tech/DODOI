import type { AIProvider, AIRequest, AIResult } from "@/server/integrations/ai/types";
import { AIProviderError } from "@/server/integrations/ai/types";

// In-memory AI provider (TESTING_STRATEGY §7: fakes only in unit and integration tests; no
// network, no key). `calls` records every request so tests can check what went into the prompt.
export function createFakeAIProvider(
  options: {
    /** Answer for a request; default echoes the last user text. */
    reply?: (request: AIRequest) => string;
    /** Requests whose last user text matches are blocked by the "safety filter". */
    blockWhen?: RegExp;
    failWith?: AIProviderError;
  } = {},
): AIProvider & { calls: AIRequest[] } {
  const calls: AIRequest[] = [];
  return {
    name: "fake",
    model: "fake-model",
    supportsVision: true,
    calls,
    async generate(request) {
      calls.push(request);
      if (options.failWith) throw options.failWith;
      const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
      const text = (lastUser?.content ?? [])
        .map((part) => (part.type === "text" ? part.text : ""))
        .join(" ");
      const base = { model: "fake-model", inputTokens: 100, outputTokens: 20, latencyMs: 5 };
      if (options.blockWhen?.test(text)) return { kind: "blocked", ...base } satisfies AIResult;
      return {
        kind: "ok",
        text: options.reply ? options.reply(request) : `Fake answer to: ${text}`,
        ...base,
      } satisfies AIResult;
    },
  };
}
