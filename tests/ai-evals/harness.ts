import { appendFileSync, mkdirSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";

import { createGeminiProvider } from "@/server/integrations/ai/gemini";
import {
  AIProviderError,
  type AIContent,
  type AIProvider,
  type AIRequest,
  type AIResult,
} from "@/server/integrations/ai/types";
import { buildSystemPrompt, type PromptParts } from "@/server/modules/ai/prompts/companion";

// Shared pieces of the AI evaluation suite (TESTING_STRATEGY §7). Everything here is synthetic:
// made-up questions, made-up posts and self-made images. The suite refuses to run with anything
// but the free tier on a local machine, because it sends content to Google.

/** dodoi skills offered to the model, as the app lists them (synthetic subset). */
export const SKILLS = ["Crochet", "Knitting", "Embroidery", "Watercolor", "Drawing", "Pottery"];

/** A made-up word the injection cases try to make the model say; it appears in no legitimate answer. */
export const CANARY = "ZEBRA-4471";

export function requireSafeEnvironment(): { provider: AIProvider } {
  const { GEMINI_API_KEY, AI_MODEL, AI_TIER, APP_ENV } = process.env;
  if (!GEMINI_API_KEY || !AI_MODEL) {
    throw new Error("The AI evals need GEMINI_API_KEY and AI_MODEL (set them in .env.local).");
  }
  if (AI_TIER !== "free" || (APP_ENV && APP_ENV !== "local")) {
    throw new Error(
      "The AI evals run only with AI_TIER=free on a local machine (they send synthetic prompts to Google, never real user data).",
    );
  }
  return { provider: createGeminiProvider({ apiKey: GEMINI_API_KEY, model: AI_MODEL }) };
}

const PAUSE_MS = 4_000;
const TRIES = 3;
let lastCall = 0;

/** One request with a pause before it (per-minute limits) and a few tries on provider failures. */
export async function generate(provider: AIProvider, request: AIRequest): Promise<AIResult> {
  let failure: unknown;
  for (let attempt = 0; attempt < TRIES; attempt += 1) {
    const wait = lastCall + PAUSE_MS * (attempt + 1) - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const result = await provider.generate(request);
      lastCall = Date.now();
      return result;
    } catch (error) {
      lastCall = Date.now();
      failure = error;
      if (!(error instanceof AIProviderError)) throw error;
    }
  }
  throw failure;
}

export type Answer = { kind: "ok"; text: string } | { kind: "blocked" };

/** Asks the companion like the app does: the real system prompt, one user turn, optional photo. */
export async function ask(
  provider: AIProvider,
  text: string,
  parts: Partial<PromptParts> = {},
  image?: { mimeType: string; data: string },
): Promise<Answer> {
  const system = buildSystemPrompt({
    context: parts.context ?? null,
    profile: parts.profile ?? null,
    skillNames: parts.skillNames ?? SKILLS,
  });
  const content: AIContent[] = [{ type: "text", text }];
  if (image) content.push({ type: "image", ...image });
  const result = await generate(provider, {
    system,
    messages: [{ role: "user", content }],
    maxOutputTokens: 800,
  });
  return result.kind === "ok" ? { kind: "ok", text: result.text } : { kind: "blocked" };
}

export const textOf = (answer: Answer): string => (answer.kind === "ok" ? answer.text : "");

/** True when every group has at least one of its words in the text (case-insensitive). */
export function coversKeyPoints(text: string, groups: string[][]): string[][] {
  const lower = text.toLowerCase();
  return groups.filter((group) => !group.some((word) => lower.includes(word.toLowerCase())));
}

export const matchesAny = (text: string, words: string[]): boolean =>
  words.some((word) => text.toLowerCase().includes(word.toLowerCase()));

const REPORT_DIR = "test-results";
const REPORT_FILE = `${REPORT_DIR}/ai-evals.jsonl`;

/** Appends one line per case to test-results/ai-evals.jsonl (git-ignored) for comparing runs. */
export function record(entry: {
  category: string;
  id: string;
  passed: boolean;
  model: string;
  note?: string;
  excerpt?: string;
}): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  appendFileSync(
    REPORT_FILE,
    `${JSON.stringify({ at: new Date().toISOString(), ...entry, excerpt: entry.excerpt?.slice(0, 300) })}\n`,
  );
}

// --- Self-made test images ----------------------------------------------------------------------

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A small RGB PNG drawn by `pixel(x, y)`; no image library or licensed file is involved. */
export function makePng(
  size: number,
  pixel: (x: number, y: number) => [number, number, number],
): { mimeType: string; data: string } {
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixel(x, y);
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return { mimeType: "image/png", data: png.toString("base64") };
}
