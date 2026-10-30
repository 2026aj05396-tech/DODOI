import { describe, expect, it } from "vitest";

import { insertSpokenText } from "./voice-text";

describe("insertSpokenText", () => {
  it("fills an empty box", () => {
    expect(insertSpokenText("", "hello there", 0, 0)).toEqual({ value: "hello there", caret: 11 });
  });

  it("adds a space after existing text", () => {
    expect(insertSpokenText("I made a bag", "from old jeans", 12, 12)).toEqual({
      value: "I made a bag from old jeans",
      caret: 27,
    });
  });

  it("inserts in the middle with a space on both sides", () => {
    const result = insertSpokenText("red scarf", "warm", 4, 4);
    expect(result.value).toBe("red warm scarf");
    expect(result.caret).toBe(8);
  });

  it("does not add a space before punctuation that follows", () => {
    expect(insertSpokenText("Nice work.", "really", 9, 9).value).toBe("Nice work really.");
  });

  it("replaces a selection", () => {
    expect(insertSpokenText("use blue wool", "green", 4, 8).value).toBe("use green wool");
  });

  it("collapses spaces and ignores empty speech", () => {
    expect(insertSpokenText("a", "  b   c ", 1, 1).value).toBe("a b c");
    expect(insertSpokenText("a", "   ", 1, 1)).toEqual({ value: "a", caret: 1 });
  });

  it("cuts to the maximum length", () => {
    const result = insertSpokenText("12345", "abcdefghij", 5, 5, 10);
    expect(result.value).toBe("12345 abcd");
    expect(result.value.length).toBe(10);
  });

  it("adds nothing when the box is already full", () => {
    expect(insertSpokenText("1234567890", "more", 10, 10, 10)).toEqual({
      value: "1234567890",
      caret: 10,
    });
  });

  it("clamps a caret outside the text", () => {
    expect(insertSpokenText("ab", "c", 99, 99).value).toBe("ab c");
  });
});
