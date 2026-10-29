// The AI provider interface (AI_INTEGRATION §4.1). Modules depend only on this, so the provider
// can be replaced; Gemini is the first one (OD-02).

export type AIContent =
  | { type: "text"; text: string }
  /** `data` is the image as base64, already shrunk by the caller. */
  | { type: "image"; mimeType: string; data: string };

export type AIChatMessage = { role: "user" | "assistant"; content: AIContent[] };

export type AIRequest = {
  system: string;
  messages: AIChatMessage[];
  maxOutputTokens: number;
  /** Ask for JSON that matches this schema (project plans, P4-03). */
  jsonSchema?: Record<string, unknown>;
};

type AIResultBase = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export type AIResult =
  | ({ kind: "ok"; text: string } & AIResultBase)
  /** The provider's safety filters stopped the request or the answer. */
  | ({ kind: "blocked" } & AIResultBase);

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly supportsVision: boolean;
  /** Throws `AIProviderError` when the provider fails; never includes prompt text in the error. */
  generate(request: AIRequest): Promise<AIResult>;
}

/** A provider failure (network, quota, bad response). The message never holds user content. */
export class AIProviderError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
  }
}
