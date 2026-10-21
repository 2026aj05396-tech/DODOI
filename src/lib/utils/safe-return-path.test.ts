import { describe, expect, it } from "vitest";

import { toSafeReturnPath } from "@/lib/utils/safe-return-path";

describe("toSafeReturnPath", () => {
  it.each(["/feed", "/p/abc123?from=search#steps", "/u/aanya-4821"])(
    "keeps in-app path %s",
    (path) => {
      expect(toSafeReturnPath(path)).toBe(path);
    },
  );

  it.each([
    ["absolute URL", "https://evil.example/feed"],
    ["protocol-relative URL", "//evil.example/feed"],
    ["backslash trick", "/\\evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative path", "feed"],
    ["tab-smuggled host", "/\t/evil.example"],
    ["empty", ""],
  ])("rejects %s", (_label, candidate) => {
    expect(toSafeReturnPath(candidate)).toBe("/");
  });

  it("normalises dot segments without leaving the site", () => {
    expect(toSafeReturnPath("/a/../../feed")).toBe("/feed");
  });

  it("uses the given fallback", () => {
    expect(toSafeReturnPath(null, "/feed")).toBe("/feed");
  });
});
