import { describe, expect, it } from "vitest";

import { robotsFor } from "./robots";

describe("robots.txt", () => {
  it("lets crawlers see only the landing page and published posts in production", () => {
    expect(robotsFor("production").rules).toEqual({
      userAgent: "*",
      allow: ["/$", "/p/"],
      disallow: "/",
    });
  });

  it("keeps local and test environments out of search engines", () => {
    expect(robotsFor("local").rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(robotsFor("test").rules).toEqual({ userAgent: "*", disallow: "/" });
  });
});
