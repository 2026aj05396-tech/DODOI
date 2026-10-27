import { afterEach, describe, expect, it, vi } from "vitest";

import { createCloudinaryProvider, signParams } from "./cloudinary";

describe("signParams", () => {
  // The worked example from Cloudinary's "Generating authentication signatures" documentation.
  it("matches Cloudinary's documented example", () => {
    expect(
      signParams(
        {
          eager: "w_400,h_300,c_pad|w_260,h_200,c_crop",
          public_id: "sample_image",
          timestamp: 1315060510,
        },
        "abcd",
      ),
    ).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });
});

describe("createCloudinaryProvider", () => {
  const provider = createCloudinaryProvider({
    cloudName: "demo",
    apiKey: "key",
    apiSecret: "secret",
  });

  it("signs the folder and allowed formats, so the browser cannot change them", () => {
    const signed = provider.signUpload({
      folder: "dodoi/local/posts",
      resourceType: "image",
      allowedFormats: "jpg,png",
    });

    expect(signed).toMatchObject({
      uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
      apiKey: "key",
      folder: "dodoi/local/posts",
    });
    expect(signed.signature).toBe(
      signParams(
        { allowed_formats: "jpg,png", folder: "dodoi/local/posts", timestamp: signed.timestamp },
        "secret",
      ),
    );
  });

  it("refuses to delete anything outside the dodoi/ folder", async () => {
    await expect(provider.deleteAsset("samples/cloudinary-logo", "image")).rejects.toThrow(
      /outside dodoi\//,
    );
  });

  it("delivers with automatic format and quality (which also strips EXIF metadata)", () => {
    expect(provider.deliveryUrl("dodoi/local/posts/a", "image")).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/dodoi/local/posts/a",
    );
    expect(provider.posterUrl("dodoi/local/posts/v")).toBe(
      "https://res.cloudinary.com/demo/video/upload/so_0,f_auto,q_auto/dodoi/local/posts/v.jpg",
    );
  });

  it("scales down to a width without ever scaling up (c_limit)", () => {
    expect(provider.deliveryUrl("dodoi/local/posts/a", "image", { width: 640 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/dodoi/local/posts/a",
    );
    expect(provider.posterUrl("dodoi/local/posts/v", { width: 320 })).toBe(
      "https://res.cloudinary.com/demo/video/upload/so_0,f_auto,q_auto,c_limit,w_320/dodoi/local/posts/v.jpg",
    );
  });

  describe("uploadFile", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("signs the public id and allowed formats and returns Cloudinary's metadata", async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          public_id: "dodoi/local/posts/seed-bee-abc",
          resource_type: "image",
          format: "jpg",
          bytes: 1234,
          width: 1200,
          height: 900,
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const asset = await provider.uploadFile({
        file: new Blob(["image"]),
        fileName: "bee.jpg",
        publicId: "dodoi/local/posts/seed-bee-abc",
        resourceType: "image",
        allowedFormats: "jpg,png",
      });

      expect(asset).toEqual({
        publicId: "dodoi/local/posts/seed-bee-abc",
        resourceType: "image",
        format: "jpg",
        bytes: 1234,
        width: 1200,
        height: 900,
        durationSec: null,
      });
      const [url, init] = fetchMock.mock.calls[0] ?? [];
      expect(url).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
      const body = init?.body as FormData;
      expect(body.get("public_id")).toBe("dodoi/local/posts/seed-bee-abc");
      expect(body.get("api_key")).toBe("key");
      expect(body.get("signature")).toBe(
        signParams(
          {
            allowed_formats: "jpg,png",
            public_id: "dodoi/local/posts/seed-bee-abc",
            timestamp: Number(body.get("timestamp")),
          },
          "secret",
        ),
      );
    });

    it("reports Cloudinary's answer when the upload is refused", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response("Invalid image file", { status: 400 })),
      );

      await expect(
        provider.uploadFile({
          file: new Blob(["x"]),
          fileName: "broken.jpg",
          publicId: "dodoi/local/posts/seed-x",
          resourceType: "image",
          allowedFormats: "jpg",
        }),
      ).rejects.toThrow(/broken\.jpg failed \(400\): Invalid image file/);
    });
  });
});
