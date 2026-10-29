import "server-only";

import { serverEnv } from "@/server/lib/env";

import { createGeminiProvider } from "./gemini";
import type { AIProvider } from "./types";

export type { AIChatMessage, AIContent, AIProvider, AIRequest, AIResult } from "./types";
export { AIProviderError } from "./types";

/**
 * The configured provider, or null while the companion is off. The environment rules already
 * refuse the free tier outside local development (env.ts).
 */
export const aiProvider: AIProvider | null =
  serverEnv.AI_ENABLED && serverEnv.GEMINI_API_KEY && serverEnv.AI_MODEL
    ? createGeminiProvider({ apiKey: serverEnv.GEMINI_API_KEY, model: serverEnv.AI_MODEL })
    : null;
