import { describe, expect, it } from "vitest";

import { formatSessionTime, localInputToIso, sessionTimeText } from "./session-time";

// 10:00 UTC on 3 Nov 2026 is 15:30 in India.
const ISO = "2026-11-03T10:00:00.000Z";

describe("session time", () => {
  it("shows the viewer's own zone and adds IST beside it elsewhere", () => {
    const london = formatSessionTime(ISO, "Europe/London");
    expect(london.local).toBe("Tue, 3 Nov, 10:00 am");
    expect(london.ist).toBe("Tue, 3 Nov, 3:30 pm IST");
    const newYork = formatSessionTime(ISO, "America/New_York");
    expect(newYork.local).toBe("Tue, 3 Nov, 5:00 am");
    expect(newYork.ist).toBe("Tue, 3 Nov, 3:30 pm IST");
  });

  it("shows no IST when the viewer already reads IST, even by an alias", () => {
    expect(formatSessionTime(ISO, "Asia/Kolkata")).toEqual({
      local: "Tue, 3 Nov, 3:30 pm",
      ist: null,
    });
    expect(formatSessionTime(ISO, "Asia/Calcutta").ist).toBeNull();
  });

  it("names the date change when IST is already the next day", () => {
    const sydney = formatSessionTime("2026-11-03T20:00:00.000Z", "Pacific/Auckland");
    expect(sydney.local).toContain("Wed, 4 Nov");
    expect(sydney.ist).toBe("Wed, 4 Nov, 1:30 am IST");
    expect(sessionTimeText(ISO, "Europe/London")).toBe(
      "Tue, 3 Nov, 10:00 am (Tue, 3 Nov, 3:30 pm IST)",
    );
  });

  it("reads typed date and time in the viewer's zone and rejects incomplete input", () => {
    const iso = localInputToIso("2026-11-03", "16:00");
    expect(iso).toBe(new Date("2026-11-03T16:00").toISOString());
    expect(localInputToIso("", "16:00")).toBeNull();
    expect(localInputToIso("2026-11-03", "")).toBeNull();
  });
});
