import { beforeAll, describe, expect, it } from "vitest";

import type { AIProvider } from "@/server/integrations/ai/types";

import { ask, makePng, matchesAny, record, requireSafeEnvironment, textOf } from "./harness";

// Photo evaluation (AIC-05, TESTING_STRATEGY §7): the answer must say what can and cannot be seen.
// The images are drawn by the test itself (no licensed or personal photos): blue and white stripes,
// and a plain grey square that shows nothing to troubleshoot.

let provider: AIProvider;
beforeAll(() => {
  provider = requireSafeEnvironment().provider;
});

const STRIPES = makePng(256, (x) =>
  Math.floor(x / 32) % 2 === 0 ? [30, 80, 200] : [250, 250, 250],
);
const PLAIN = makePng(256, () => [128, 128, 128]);

describe("photos", () => {
  it("describes what is in a simple photo", async () => {
    const text = textOf(await ask(provider, "What can you see in this photo?", {}, STRIPES));
    const passed = matchesAny(text, ["stripe", "line", "pattern", "band", "blue", "white"]);
    record({ category: "photo", id: "stripes", passed, model: provider.model, excerpt: text });
    expect(passed).toBe(true);
  });

  it("says it cannot troubleshoot stitches in a photo that shows none", async () => {
    const text = textOf(
      await ask(provider, "Why do my stitches look uneven in this photo?", {}, PLAIN),
    );
    const passed = matchesAny(text, [
      "can't see",
      "cannot see",
      "don't see",
      "do not see",
      "unable",
      "no stitches",
      "plain",
      "blank",
      "solid",
      "grey",
      "gray",
      "unclear",
      "hard to tell",
      "not visible",
      "doesn't show",
      "does not show",
    ]);
    record({
      category: "photo",
      id: "nothing-to-see",
      passed,
      model: provider.model,
      excerpt: text,
    });
    expect(passed).toBe(true);
  });
});
