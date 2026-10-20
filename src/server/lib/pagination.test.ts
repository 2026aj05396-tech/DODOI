import { describe, expect, it } from "vitest";
import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants/pagination";
import { ValidationError } from "@/server/lib/errors";
import { decodeCursor, encodeCursor, resolvePageSize } from "@/server/lib/pagination";

const cursorSchema = z.object({ createdAt: z.string(), id: z.string() });

describe("encodeCursor / decodeCursor", () => {
  it("round-trips a payload through an opaque URL-safe string", () => {
    const payload = { createdAt: "2026-10-20T10:00:00.000Z", id: "post_1" };

    const cursor = encodeCursor(payload);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor, cursorSchema)).toEqual(payload);
  });

  it("rejects a cursor that is not valid encoded JSON", () => {
    expect(() => decodeCursor("%%%not-a-cursor", cursorSchema)).toThrow(ValidationError);
  });

  it("rejects a cursor whose payload does not match the schema", () => {
    const tampered = encodeCursor({ id: 42 });

    expect(() => decodeCursor(tampered, cursorSchema)).toThrow(ValidationError);
  });
});

describe("resolvePageSize", () => {
  it("uses the default when no size is requested", () => {
    expect(resolvePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("caps requests above the maximum", () => {
    expect(resolvePageSize(500)).toBe(MAX_PAGE_SIZE);
  });

  it("raises zero or negative sizes to one", () => {
    expect(resolvePageSize(0)).toBe(1);
    expect(resolvePageSize(-5)).toBe(1);
  });

  it("drops fractions", () => {
    expect(resolvePageSize(12.7)).toBe(12);
  });
});
