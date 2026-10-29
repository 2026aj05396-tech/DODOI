import { AIProviderError, type AIProvider, type AIRequest, type AIResult } from "./types";

// Google Gemini over plain REST (no SDK, like Cloudinary): POST models/{model}:generateContent with
// the key in the x-goog-api-key header, so it never appears in a URL or a log. Safety filters are
// on for every request at "block medium and above" (PO, AI_INTEGRATION §9).

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// Two tries of at most 25 s keep a request inside the 60 s a route may run on Vercel Hobby.
const TIMEOUT_MS = 25_000;
/** One more try after a 500 or 503 ("high demand" spikes are brief), then the error stands. */
const RETRY_STATUSES = new Set([500, 503]);
const RETRY_DELAY_MS = 1_000;

const SAFETY_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
] as const;

/** Finish reasons that mean the filters, not a failure, ended the answer. */
const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "IMAGE_SAFETY",
  "RECITATION",
]);

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
};

export type GeminiOptions = {
  apiKey: string;
  model: string;
  /** Tests pass a fake `fetch`. */
  fetch?: typeof fetch;
};

function toBody(request: AIRequest) {
  return {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: request.messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: message.content.map((part) =>
        part.type === "text"
          ? { text: part.text }
          : { inlineData: { mimeType: part.mimeType, data: part.data } },
      ),
    })),
    generationConfig: {
      maxOutputTokens: request.maxOutputTokens,
      // Gemini 3 models count hidden "thinking" tokens inside maxOutputTokens: at the default level a
      // short reply was cut off after a few words (measured 2026-10-29). Minimal keeps the whole
      // budget for the answer. Needs a Gemini 3.x model (AI_INTEGRATION §13).
      thinkingConfig: { thinkingLevel: "minimal" },
      ...(request.jsonSchema
        ? { responseMimeType: "application/json", responseSchema: request.jsonSchema }
        : {}),
    },
    safetySettings: SAFETY_CATEGORIES.map((category) => ({
      category,
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    })),
  };
}

export function createGeminiProvider({
  apiKey,
  model,
  fetch: fetchImpl = fetch,
}: GeminiOptions): AIProvider {
  return {
    name: "gemini",
    model,
    supportsVision: true,
    async generate(request) {
      const started = Date.now();
      const send = () =>
        fetchImpl(`${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(toBody(request)),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      let response: Response;
      try {
        response = await send();
        if (RETRY_STATUSES.has(response.status)) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          response = await send();
        }
      } catch {
        throw new AIProviderError("The AI provider could not be reached.");
      }
      // The body of an error response can echo the prompt: report the status only.
      if (!response.ok) {
        throw new AIProviderError(`The AI provider answered ${response.status}.`, response.status);
      }
      const data = (await response.json().catch(() => null)) as GeminiResponse | null;
      if (!data) throw new AIProviderError("The AI provider sent an unreadable answer.");

      const usage = data.usageMetadata;
      const base = {
        model,
        inputTokens: usage?.promptTokenCount ?? 0,
        // Thinking tokens are billed as output.
        outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
        latencyMs: Date.now() - started,
      };

      if (data.promptFeedback?.blockReason) return { kind: "blocked", ...base } satisfies AIResult;
      const candidate = data.candidates?.[0];
      const text = (candidate?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim();
      if (candidate?.finishReason && BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
        return { kind: "blocked", ...base } satisfies AIResult;
      }
      if (!text) throw new AIProviderError("The AI provider sent an empty answer.");
      return { kind: "ok", text, ...base } satisfies AIResult;
    },
  };
}
