import { describe, expect, it } from "vitest";

import { isSameOriginRequest } from "@/server/lib/origin";

function request(method: string, headers: Record<string, string>): Request {
  return new Request("http://dodoi.test/api/saves/abc", { method, headers });
}

describe("isSameOriginRequest", () => {
  it("always allows safe methods", () => {
    expect(isSameOriginRequest(request("GET", { origin: "https://evil.example" }))).toBe(true);
  });

  it("allows a mutation whose Origin matches the host", () => {
    expect(
      isSameOriginRequest(request("POST", { origin: "https://dodoi.test", host: "dodoi.test" })),
    ).toBe(true);
  });

  it("rejects a mutation from another site", () => {
    expect(
      isSameOriginRequest(request("POST", { origin: "https://evil.example", host: "dodoi.test" })),
    ).toBe(false);
  });

  it("compares against the public host forwarded by the hosting proxy", () => {
    expect(
      isSameOriginRequest(
        request("DELETE", {
          origin: "https://dodoi.app",
          host: "internal:3000",
          "x-forwarded-host": "dodoi.app",
        }),
      ),
    ).toBe(true);
  });

  it("rejects the opaque 'null' origin and malformed origins", () => {
    expect(isSameOriginRequest(request("POST", { origin: "null", host: "dodoi.test" }))).toBe(
      false,
    );
    expect(isSameOriginRequest(request("POST", { origin: "not a url", host: "dodoi.test" }))).toBe(
      false,
    );
  });

  it("falls back to Sec-Fetch-Site when Origin is missing", () => {
    expect(isSameOriginRequest(request("PUT", { "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOriginRequest(request("PUT", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(request("PUT", { "sec-fetch-site": "same-site" }))).toBe(false);
  });

  it("allows non-browser clients that send neither header", () => {
    expect(isSameOriginRequest(request("POST", {}))).toBe(true);
  });
});
