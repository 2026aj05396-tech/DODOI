import { describe, expect, it } from "vitest";

import { isIosSafari, shouldOfferInstall } from "@/lib/utils/install-offer";

const NOW = Date.UTC(2026, 9, 27);
const DAY = 24 * 60 * 60 * 1000;

describe("shouldOfferInstall", () => {
  it("waits for a save or a second visit", () => {
    expect(shouldOfferInstall({ visits: 1, hasSaved: false, dismissedAt: null }, NOW)).toBe(false);
    expect(shouldOfferInstall({ visits: 1, hasSaved: true, dismissedAt: null }, NOW)).toBe(true);
    expect(shouldOfferInstall({ visits: 2, hasSaved: false, dismissedAt: null }, NOW)).toBe(true);
  });

  it("stays away for 30 days after it is dismissed", () => {
    const engaged = { visits: 5, hasSaved: true };
    expect(shouldOfferInstall({ ...engaged, dismissedAt: NOW - 29 * DAY }, NOW)).toBe(false);
    expect(shouldOfferInstall({ ...engaged, dismissedAt: NOW - 30 * DAY }, NOW)).toBe(true);
  });
});

describe("isIosSafari", () => {
  const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const IPAD_DESKTOP_MODE =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const IPHONE_CHROME =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1";
  const ANDROID_CHROME =
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";

  it("recognises Safari on iPhone and iPad", () => {
    expect(isIosSafari(IPHONE_SAFARI, 5)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_MODE, 5)).toBe(true);
  });

  it("leaves out other iOS browsers, Macs and Android", () => {
    expect(isIosSafari(IPHONE_CHROME, 5)).toBe(false);
    expect(isIosSafari(IPAD_DESKTOP_MODE, 0)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME, 5)).toBe(false);
  });
});
