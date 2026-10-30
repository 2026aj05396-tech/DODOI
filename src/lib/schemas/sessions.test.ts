import { describe, expect, it } from "vitest";

import { meetingUrlSchema, proposeSessionSchema, sessionActionSchema } from "./sessions";

describe("session schemas", () => {
  it("accepts https meeting links only, with a real host and no password", () => {
    for (const ok of ["https://meet.google.com/abc-defg-hij", "https://zoom.us/j/123?pwd=abc"]) {
      expect(meetingUrlSchema.safeParse(ok).success).toBe(true);
    }
    for (const bad of [
      "http://meet.google.com/abc",
      "javascript:alert(1)",
      "https://user:pass@meet.example.com/x",
      "https://localhost/x",
      "meet.google.com/abc",
      "",
      "https://" + "a".repeat(500) + ".com",
    ]) {
      expect(meetingUrlSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("allows 15, 30, 45 or 60 minutes and a zoned time", () => {
    const base = {
      inviteeUsername: "ravi",
      startsAt: "2026-11-03T10:00:00.000Z",
      meetingUrl: "https://meet.google.com/abc",
    };
    for (const durationMin of [15, 30, 45, 60]) {
      expect(proposeSessionSchema.safeParse({ ...base, durationMin }).success).toBe(true);
    }
    expect(proposeSessionSchema.safeParse({ ...base, durationMin: 20 }).success).toBe(false);
    expect(
      proposeSessionSchema.safeParse({ ...base, durationMin: 30, startsAt: "tomorrow 4pm" })
        .success,
    ).toBe(false);
  });

  it("treats an empty note as none, and RESCHEDULE needs a time", () => {
    const parsed = proposeSessionSchema.parse({
      inviteeUsername: "ravi",
      startsAt: "2026-11-03T10:00:00.000Z",
      durationMin: 30,
      meetingUrl: "https://meet.google.com/abc",
      note: "   ",
    });
    expect(parsed.note).toBeUndefined();
    expect(sessionActionSchema.safeParse({ action: "RESCHEDULE" }).success).toBe(false);
    expect(sessionActionSchema.safeParse({ action: "ACCEPT" }).success).toBe(true);
  });
});
