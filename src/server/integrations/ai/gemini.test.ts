import { describe, expect, it, vi } from "vitest";

import { createGeminiProvider } from "./gemini";
import { AIProviderError, type AIRequest } from "./types";

// Gemini adapter (P4-01, AI_INTEGRATION §4.1): the request shape, how answers, filter blocks and
// failures are read, and that an error never carries the prompt. No network: `fetch` is a fake.

const request: AIRequest = {
  system: "You are kind.",
  maxOutputTokens: 800,
  messages: [
    { role: "user", content: [{ type: "text", text: "Hello" }] },
    { role: "assistant", content: [{ type: "text", text: "Hi!" }] },
    {
      role: "user",
      content: [
        { type: "text", text: "Why is this wavy?" },
        { type: "image", mimeType: "image/jpeg", data: "QUJD" },
      ],
    },
  ],
};

function provider(body: unknown, init: { status?: number } = {}) {
  const fetchFake = vi.fn(
    async () => new Response(JSON.stringify(body), { status: init.status ?? 200 }),
  );
  return {
    fetchFake,
    gemini: createGeminiProvider({
      apiKey: "secret-key",
      model: "test-model",
      fetch: fetchFake as unknown as typeof fetch,
    }),
  };
}

describe("gemini provider", () => {
  it("posts to generateContent with the key in a header, the safety filters on and images inline", async () => {
    const { gemini, fetchFake } = provider({
      candidates: [{ content: { parts: [{ text: "Try this." }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 10, thoughtsTokenCount: 5 },
    });

    const result = await gemini.generate(request);

    const [url, init] = fetchFake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent",
    );
    expect(url).not.toContain("secret-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("You are kind.");
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
    expect(body.contents[2].parts[1]).toEqual({
      inlineData: { mimeType: "image/jpeg", data: "QUJD" },
    });
    expect(body.generationConfig.maxOutputTokens).toBe(800);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
    expect(body.safetySettings).toHaveLength(4);
    expect(
      body.safetySettings.every(
        (s: { threshold: string }) => s.threshold === "BLOCK_MEDIUM_AND_ABOVE",
      ),
    ).toBe(true);
    expect(result).toMatchObject({
      kind: "ok",
      text: "Try this.",
      inputTokens: 50,
      outputTokens: 15,
      model: "test-model",
    });
  });

  it("asks for JSON when a schema is given", async () => {
    const { gemini, fetchFake } = provider({
      candidates: [{ content: { parts: [{ text: "{}" }] } }],
    });
    await gemini.generate({ ...request, jsonSchema: { type: "OBJECT" } });
    const body = JSON.parse(
      (fetchFake.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT" },
    });
  });

  it("reports a blocked prompt or a filtered answer as blocked, not as an error", async () => {
    const blockedPrompt = await provider({
      promptFeedback: { blockReason: "SAFETY" },
    }).gemini.generate(request);
    const filtered = await provider({
      candidates: [{ finishReason: "SAFETY" }],
      usageMetadata: { promptTokenCount: 7 },
    }).gemini.generate(request);

    expect(blockedPrompt.kind).toBe("blocked");
    expect(filtered).toMatchObject({ kind: "blocked", inputTokens: 7 });
  });

  it("fails with the status only, never the provider's body", async () => {
    const { gemini } = provider(
      { error: { message: "echo of the user's prompt" } },
      { status: 429 },
    );
    const error = await gemini.generate(request).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).status).toBe(429);
    expect((error as AIProviderError).message).not.toContain("echo");
  });

  it("tries once more after a 503, then gives up", async () => {
    const good = {
      candidates: [{ content: { parts: [{ text: "Second time lucky." }] }, finishReason: "STOP" }],
    };
    const flaky = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(good), { status: 200 }));
    const recovered = createGeminiProvider({
      apiKey: "k",
      model: "m",
      fetch: flaky as unknown as typeof fetch,
    });
    await expect(recovered.generate(request)).resolves.toMatchObject({
      text: "Second time lucky.",
    });
    expect(flaky).toHaveBeenCalledTimes(2);

    const down = vi.fn(async () => new Response("{}", { status: 503 }));
    const failing = createGeminiProvider({
      apiKey: "k",
      model: "m",
      fetch: down as unknown as typeof fetch,
    });
    await expect(failing.generate(request)).rejects.toMatchObject({ status: 503 });
    expect(down).toHaveBeenCalledTimes(2);
  });

  it("fails on an empty answer and on a network error", async () => {
    await expect(
      provider({ candidates: [{ content: { parts: [] }, finishReason: "STOP" }] }).gemini.generate(
        request,
      ),
    ).rejects.toBeInstanceOf(AIProviderError);
    const down = createGeminiProvider({
      apiKey: "k",
      model: "m",
      fetch: (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    });
    await expect(down.generate(request)).rejects.toBeInstanceOf(AIProviderError);
  });
});
