import { describe, expect, it } from "vitest";

import { checkDeclaredUpload, checkUploadedAsset, type UploadedAsset } from "./media-rules";

const MB = 1024 * 1024;

const image = (overrides: Partial<UploadedAsset> = {}): UploadedAsset => ({
  resourceType: "image",
  format: "jpg",
  bytes: 2 * MB,
  width: 1200,
  height: 900,
  durationSec: null,
  ...overrides,
});

const video = (overrides: Partial<UploadedAsset> = {}): UploadedAsset => ({
  resourceType: "video",
  format: "mp4",
  bytes: 20 * MB,
  width: 1080,
  height: 1920,
  durationSec: 42,
  ...overrides,
});

describe("checkDeclaredUpload", () => {
  it("accepts allowed types within the limit", () => {
    expect(
      checkDeclaredUpload("post", "IMAGE", { bytes: 9 * MB, mimeType: "image/heic" }),
    ).toBeNull();
    expect(
      checkDeclaredUpload("post", "VIDEO", { bytes: 50 * MB, mimeType: "video/quicktime" }),
    ).toBeNull();
  });

  it("refuses other types, too-large files, and videos outside posts", () => {
    expect(checkDeclaredUpload("post", "IMAGE", { bytes: MB, mimeType: "image/gif" })?.kind).toBe(
      "type",
    );
    expect(
      checkDeclaredUpload("post", "IMAGE", { bytes: 11 * MB, mimeType: "image/png" })?.kind,
    ).toBe("size");
    expect(
      checkDeclaredUpload("avatar", "IMAGE", { bytes: 6 * MB, mimeType: "image/png" })?.kind,
    ).toBe("size");
    expect(checkDeclaredUpload("avatar", "VIDEO", { bytes: MB, mimeType: "video/mp4" })?.kind).toBe(
      "type",
    );
  });
});

describe("checkUploadedAsset", () => {
  it("accepts compliant images and videos", () => {
    expect(checkUploadedAsset("post", "IMAGE", image())).toBeNull();
    expect(checkUploadedAsset("post", "VIDEO", video({ durationSec: 60 }))).toBeNull();
    expect(checkUploadedAsset("avatar", "IMAGE", image({ width: 200, height: 200 }))).toBeNull();
  });

  it.each([
    ["a GIF", image({ format: "gif" }), "type"],
    ["a video posted as an image", video(), "type"],
    ["an image over 10 MB", image({ bytes: 10 * MB + 1 }), "size"],
    [
      "an image under 600 px on its shortest side",
      image({ width: 1200, height: 599 }),
      "dimensions",
    ],
  ] as const)("rejects %s", (_label, asset, kind) => {
    expect(checkUploadedAsset("post", "IMAGE", asset)?.kind).toBe(kind);
  });

  it.each([
    ["over 60 seconds", video({ durationSec: 60.5 }), "duration"],
    ["with no known duration", video({ durationSec: null }), "duration"],
    ["over 50 MB", video({ bytes: 50 * MB + 1 }), "size"],
    ["in another format", video({ format: "avi" }), "type"],
  ] as const)("rejects a video %s", (_label, asset, kind) => {
    expect(checkUploadedAsset("post", "VIDEO", asset)?.kind).toBe(kind);
  });
});
