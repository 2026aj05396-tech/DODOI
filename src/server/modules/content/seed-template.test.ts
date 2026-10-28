import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { seedPostFileSchema } from "@/lib/schemas/admin";

import { attributionProblems } from "./publish-rules";

// The example posts in docs/seed-content (P1-19 template) must stay valid seed files, so the
// template can't drift from the importer's rules.

const FOLDER = path.resolve(__dirname, "../../../../docs/seed-content/posts");
const FILES = readdirSync(FOLDER).filter((name) => name.endsWith(".json"));

describe("seed content template", () => {
  it("has an example for every attribution source type", () => {
    const types = FILES.map(
      (name) => JSON.parse(readFileSync(path.join(FOLDER, name), "utf8")).attribution.sourceType,
    );
    expect(new Set(types)).toEqual(
      new Set(["TEAM_ORIGINAL", "INVITED_CREATOR", "STOCK_LICENSED", "CREATIVE_COMMONS"]),
    );
  });

  it.each(FILES)("%s is a valid seed file", (name) => {
    const file = seedPostFileSchema.parse(
      JSON.parse(readFileSync(path.join(FOLDER, name), "utf8")),
    );
    expect(`${file.seedKey}.json`).toBe(name);
    // Invited-creator posts need an account; any id stands in for it here.
    const authorId = file.authorUsername ? "creator-id" : null;
    const attribution = {
      ...file.attribution,
      originalAuthor: file.attribution.originalAuthor ?? null,
      originalUrl: file.attribution.originalUrl ?? null,
      permissionRef: file.attribution.permissionRef ?? null,
    };
    expect(attributionProblems(attribution, authorId)).toEqual({});
  });
});
