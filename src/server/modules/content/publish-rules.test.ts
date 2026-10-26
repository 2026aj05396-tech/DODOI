import { describe, expect, it } from "vitest";

import { publishProblems, type PublishState } from "./publish-rules";

type AttributionState = NonNullable<PublishState["attribution"]>;

const TEAM_ATTRIBUTION: AttributionState = {
  sourceType: "TEAM_ORIGINAL",
  license: "Owned",
  attributionText: "Made by the dodoi team",
  originalAuthor: null,
  originalUrl: null,
  permissionRef: null,
};

const ready = (overrides: Partial<PublishState> = {}): PublishState => ({
  skills: [{ skillId: "s1", isPrimary: true }],
  skillStatuses: new Map([["s1", "ACTIVE"]]),
  media: [{ type: "IMAGE", altText: "A granny square" }],
  stepMedia: [],
  attribution: TEAM_ATTRIBUTION,
  authorId: null,
  ...overrides,
});

const attribution = (overrides: Partial<AttributionState>): AttributionState => ({
  ...TEAM_ATTRIBUTION,
  ...overrides,
});

describe("publishProblems", () => {
  it("accepts a complete team-original post, including one with only a video", () => {
    expect(publishProblems(ready())).toEqual({});
    expect(publishProblems(ready({ media: [{ type: "VIDEO", altText: null }] }))).toEqual({});
  });

  it("needs skills with an active main skill, media and alt text on every image", () => {
    expect(publishProblems(ready({ skills: [] }))).toHaveProperty("skillIds");
    expect(
      publishProblems(ready({ skills: [{ skillId: "s1", isPrimary: false }] })),
    ).toHaveProperty("primarySkillId", "Choose the main skill.");
    expect(publishProblems(ready({ skillStatuses: new Map([["s1", "HIDDEN"]]) }))).toHaveProperty(
      "primarySkillId",
    );
    expect(publishProblems(ready({ media: [] }))).toHaveProperty("mediaIds");
    expect(publishProblems(ready({ media: [{ type: "IMAGE", altText: " " }] }))).toHaveProperty(
      "mediaIds",
      "Every photo needs alt text.",
    );
    expect(
      publishProblems(ready({ stepMedia: [{ type: "IMAGE", altText: null }] })),
    ).toHaveProperty("steps");
    expect(publishProblems(ready({ attribution: null }))).toHaveProperty("attribution");
  });

  it("allows Creative Commons only as CC BY or CC BY-SA, with author and source link", () => {
    const cc = (license: string, extra = {}) =>
      publishProblems(
        ready({
          attribution: attribution({
            sourceType: "CREATIVE_COMMONS",
            license,
            originalAuthor: "Mira",
            originalUrl: "https://example.org/a",
            ...extra,
          }),
        }),
      );

    expect(cc("CC BY 4.0")).toEqual({});
    expect(cc("CC BY-SA 4.0")).toEqual({});
    expect(cc("CC BY-NC 4.0")).toHaveProperty("attribution.license");
    expect(cc("CC BY-ND 4.0")).toHaveProperty("attribution.license");
    expect(cc("CC BY 4.0", { originalAuthor: null, originalUrl: null })).toMatchObject({
      "attribution.originalAuthor": expect.any(String),
      "attribution.originalUrl": expect.any(String),
    });
  });

  it("needs a source link for stock content", () => {
    const stock = attribution({ sourceType: "STOCK_LICENSED", license: "Pexels License" });
    expect(publishProblems(ready({ attribution: stock }))).toHaveProperty(
      "attribution.originalUrl",
    );
  });

  it("needs a creator account and permission for invited creators, and no creator otherwise", () => {
    const invited = attribution({ sourceType: "INVITED_CREATOR" });

    expect(publishProblems(ready({ attribution: invited }))).toMatchObject({
      authorUsername: expect.any(String),
      "attribution.permissionRef": expect.any(String),
    });
    expect(
      publishProblems(
        ready({ attribution: { ...invited, permissionRef: "email 2026-10-01" }, authorId: "u1" }),
      ),
    ).toEqual({});
    expect(publishProblems(ready({ authorId: "u1" }))).toHaveProperty("authorUsername");
  });
});
