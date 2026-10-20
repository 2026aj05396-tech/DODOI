import { afterEach, describe, expect, it, vi } from "vitest";

import { logger, redact } from "@/server/lib/logger";

describe("redact", () => {
  it("replaces sensitive keys at any depth, including inside arrays", () => {
    const result = redact({
      userId: "u1",
      password: "hunter2",
      nested: { accessToken: "abc", email: "a@b.com", note: "kept" },
      list: [{ cookie: "session=1" }],
    });

    expect(result).toEqual({
      userId: "u1",
      password: "[redacted]",
      nested: { accessToken: "[redacted]", email: "[redacted]", note: "kept" },
      list: [{ cookie: "[redacted]" }],
    });
  });

  it("reduces errors to name and message so stack traces and causes stay out of logs", () => {
    expect(redact(new TypeError("boom"))).toEqual({ name: "TypeError", message: "boom" });
  });
});

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes one JSON line per entry with redacted fields", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    logger.info("user signed in", { userId: "u1", password: "secret" });

    const line = String(stdout.mock.calls[0]?.[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry).toMatchObject({ level: "info", message: "user signed in", userId: "u1" });
    expect(entry.password).toBe("[redacted]");
    expect(line.endsWith("\n")).toBe(true);
  });

  it("sends warnings and errors to stderr", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    logger.error("failed");

    expect(stderr).toHaveBeenCalledOnce();
  });
});
