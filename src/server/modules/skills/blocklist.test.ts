import { describe, expect, it } from "vitest";

import { createBlocklistMatcher } from "./blocklist";

// Neutral stand-in words; the real list is tested in blocked-terms.test.ts.
const isBlocked = createBlocklistMatcher(["badword", "two words"]);

describe("createBlocklistMatcher", () => {
  it("matches a blocked word anywhere in the name, ignoring case", () => {
    expect(isBlocked("Painting BADWORD things")).toBe(true);
  });

  it("matches common character swaps", () => {
    expect(isBlocked("b4dw0rd")).toBe(true);
  });

  it("matches a blocked word spelled with spaces or hyphens", () => {
    expect(isBlocked("b a d w o r d")).toBe(true);
    expect(isBlocked("bad-word")).toBe(true);
  });

  it("matches blocked phrases, also inside a longer name", () => {
    expect(isBlocked("Two  Words")).toBe(true);
    expect(isBlocked("Painting two words at night")).toBe(true);
    expect(isBlocked("Two of my words")).toBe(false);
  });

  it("does not reject harmless words that merely contain a blocked string", () => {
    expect(isBlocked("badwordsmith")).toBe(false);
    expect(isBlocked("Crochet")).toBe(false);
  });

  it("never blocks anything with an empty list", () => {
    expect(createBlocklistMatcher([])("anything")).toBe(false);
  });
});
