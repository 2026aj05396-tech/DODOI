import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import type { ProviderAsset } from "@/server/integrations/media/types";
import { RateLimitError } from "@/server/lib/errors";
import {
  deleteOrphanedMedia,
  registerMedia,
  signMediaUpload,
  updateMedia,
} from "@/server/modules/content";

import { resetDatabase } from "../helpers/database";
import { actorFor, createSkill, createUser } from "../helpers/factories";
import { createFakeMediaProvider } from "../helpers/fake-media";

// Media pipeline (roadmap P1-03): sign → upload to Cloudinary → register with re-verification.

const MB = 1024 * 1024;
const POSTS = "dodoi/local/posts";

function uploaded(publicId: string, overrides: Partial<ProviderAsset> = {}): ProviderAsset {
  return {
    publicId,
    resourceType: "image",
    format: "jpg",
    bytes: 2 * MB,
    width: 1600,
    height: 1200,
    durationSec: null,
    ...overrides,
  };
}

async function admin() {
  return actorFor(await createUser(), "ADMIN");
}

describe("media", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.$disconnect();
  });

  describe("signMediaUpload", () => {
    it("signs an admin's upload into the environment's folder with the allowed formats", async () => {
      const provider = createFakeMediaProvider();

      const signed = await signMediaUpload(
        await admin(),
        { purpose: "post", type: "VIDEO", bytes: 30 * MB, mimeType: "video/mp4" },
        { provider },
      );

      expect(signed).toMatchObject({
        folder: POSTS,
        resourceType: "video",
        allowedFormats: "mp4,mov,webm",
      });
    });

    it("signs a user's post and journal uploads (P2-01); covers stay admin-only", async () => {
      const user = actorFor(await createUser());
      const provider = createFakeMediaProvider();
      const image = { type: "IMAGE", bytes: MB, mimeType: "image/jpeg" } as const;

      await expect(
        signMediaUpload(
          user,
          { purpose: "post", type: "VIDEO", bytes: 30 * MB, mimeType: "video/mp4" },
          { provider },
        ),
      ).resolves.toMatchObject({ folder: POSTS, resourceType: "video" });
      await expect(
        signMediaUpload(user, { purpose: "entry", ...image }, { provider }),
      ).resolves.toMatchObject({ folder: "dodoi/local/entries", resourceType: "image" });
      await expect(signMediaUpload(user, { purpose: "cover", ...image })).rejects.toMatchObject({
        status: 404,
      });
      await expect(signMediaUpload(null, { purpose: "post", ...image })).rejects.toMatchObject({
        status: 404,
      });
    });

    it("refuses videos for journal photos", async () => {
      await expect(
        signMediaUpload(actorFor(await createUser()), {
          purpose: "entry",
          type: "VIDEO",
          bytes: MB,
          mimeType: "video/mp4",
        }),
      ).rejects.toMatchObject({ status: 400, code: "UNSUPPORTED_MEDIA_TYPE" });
    });

    it("refuses oversized and unsupported files before signing", async () => {
      const actor = await admin();
      const provider = createFakeMediaProvider();

      await expect(
        signMediaUpload(
          actor,
          { purpose: "post", type: "IMAGE", bytes: 11 * MB, mimeType: "image/png" },
          { provider },
        ),
      ).rejects.toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
      await expect(
        signMediaUpload(
          actor,
          { purpose: "post", type: "IMAGE", bytes: MB, mimeType: "image/gif" },
          { provider },
        ),
      ).rejects.toMatchObject({ status: 400, code: "UNSUPPORTED_MEDIA_TYPE" });
    });

    it("allows 30 signatures per hour per user", async () => {
      const actor = await admin();
      const provider = createFakeMediaProvider();
      const input = { purpose: "post", type: "IMAGE", bytes: MB, mimeType: "image/jpeg" } as const;
      for (let index = 0; index < 30; index += 1) {
        await signMediaUpload(actor, input, { provider });
      }

      await expect(signMediaUpload(actor, input, { provider })).rejects.toBeInstanceOf(
        RateLimitError,
      );
    });
  });

  describe("registerMedia", () => {
    it("saves a compliant image with its real metadata and returns delivery URLs", async () => {
      const provider = createFakeMediaProvider();
      provider.assets.set(`${POSTS}/a`, uploaded(`${POSTS}/a`));

      const media = await registerMedia(
        await admin(),
        { purpose: "post", type: "IMAGE", publicId: `${POSTS}/a`, altText: "Granny square" },
        { provider },
      );

      expect(media).toEqual({
        id: expect.any(String),
        type: "IMAGE",
        url: `https://cdn.test/image/${POSTS}/a`,
        width: 1600,
        height: 1200,
        altText: "Granny square",
        // Scaled copies below the 1600px original, then the original itself.
        srcSet: [320, 640, 960, 1280, 1600]
          .map((width) => `https://cdn.test/image/w${width}/${POSTS}/a ${width}w`)
          .join(", "),
      });
      expect(await db.mediaAsset.findUniqueOrThrow({ where: { id: media.id } })).toMatchObject({
        bytes: 2 * MB,
        format: "jpg",
      });
    });

    it("saves a compliant video with its poster and duration", async () => {
      const provider = createFakeMediaProvider();
      provider.assets.set(
        `${POSTS}/v`,
        uploaded(`${POSTS}/v`, { resourceType: "video", format: "mp4", durationSec: 42 }),
      );

      const media = await registerMedia(
        await admin(),
        { purpose: "post", type: "VIDEO", publicId: `${POSTS}/v` },
        { provider },
      );

      expect(media).toMatchObject({
        posterUrl: `https://cdn.test/poster/${POSTS}/v.jpg`,
        durationSec: 42,
      });
      // The poster is the still for a video, up to the original's 1600px.
      expect(media.srcSet.split(", ").at(-1)).toBe(
        `https://cdn.test/poster/w1600/${POSTS}/v.jpg 1600w`,
      );
    });

    it.each([
      ["over 10 MB", uploaded(`${POSTS}/x`, { bytes: 10 * MB + 1 }), 413],
      ["in the wrong format", uploaded(`${POSTS}/x`, { format: "gif" }), 400],
    ])("deletes an image %s from Cloudinary and rejects it", async (_label, asset, status) => {
      const provider = createFakeMediaProvider();
      provider.assets.set(asset.publicId, asset);

      await expect(
        registerMedia(
          await admin(),
          { purpose: "post", type: "IMAGE", publicId: asset.publicId, altText: "Alt" },
          { provider },
        ),
      ).rejects.toMatchObject({ status });
      expect(provider.deleted).toEqual([asset.publicId]);
      expect(await db.mediaAsset.count()).toBe(0);
    });

    it("deletes a video longer than 60 seconds and rejects it", async () => {
      const provider = createFakeMediaProvider();
      provider.assets.set(
        `${POSTS}/long`,
        uploaded(`${POSTS}/long`, { resourceType: "video", format: "mp4", durationSec: 61 }),
      );

      await expect(
        registerMedia(
          await admin(),
          { purpose: "post", type: "VIDEO", publicId: `${POSTS}/long` },
          { provider },
        ),
      ).rejects.toMatchObject({ status: 400, code: "MEDIA_REJECTED" });
      expect(provider.deleted).toEqual([`${POSTS}/long`]);
    });

    it("refuses uploads outside the signed folder, unknown uploads and duplicates", async () => {
      const actor = await admin();
      const provider = createFakeMediaProvider();
      provider.assets.set(`${POSTS}/a`, uploaded(`${POSTS}/a`));
      const register = (publicId: string) =>
        registerMedia(
          actor,
          { purpose: "post", type: "IMAGE", publicId, altText: "Alt" },
          { provider },
        );

      await expect(register("someone-else/photo")).rejects.toMatchObject({
        code: "MEDIA_NOT_FOUND",
      });
      await expect(register(`${POSTS}/missing`)).rejects.toMatchObject({
        code: "MEDIA_NOT_FOUND",
      });
      await register(`${POSTS}/a`);
      await expect(register(`${POSTS}/a`)).rejects.toMatchObject({
        status: 409,
        code: "MEDIA_ALREADY_REGISTERED",
      });
      expect(provider.deleted).toEqual([]);
    });

    it("accepts an image without alt text (publishing a post requires it later)", async () => {
      const provider = createFakeMediaProvider();
      provider.assets.set(`${POSTS}/a`, uploaded(`${POSTS}/a`));

      const media = await registerMedia(
        await admin(),
        { purpose: "post", type: "IMAGE", publicId: `${POSTS}/a` },
        { provider },
      );

      expect(media.altText).toBeNull();
    });
  });

  it("lets an admin change alt text", async () => {
    const actor = await admin();
    const provider = createFakeMediaProvider();
    provider.assets.set(`${POSTS}/a`, uploaded(`${POSTS}/a`));
    const media = await registerMedia(
      actor,
      { purpose: "post", type: "IMAGE", publicId: `${POSTS}/a`, altText: "Old" },
      { provider },
    );

    const updated = await updateMedia(
      actor,
      media.id,
      { altText: "A granny square in teal" },
      { provider },
    );

    expect(updated.altText).toBe("A granny square in teal");
  });

  it("lets the uploader change their own alt text, and nobody else but admins", async () => {
    const provider = createFakeMediaProvider();
    provider.assets.set(`${POSTS}/mine`, uploaded(`${POSTS}/mine`));
    const owner = actorFor(await createUser());
    const media = await registerMedia(
      owner,
      { purpose: "post", type: "IMAGE", publicId: `${POSTS}/mine` },
      { provider },
    );
    const input = { altText: "My first pinch pot" };

    await expect(updateMedia(owner, media.id, input, { provider })).resolves.toMatchObject({
      altText: "My first pinch pot",
    });
    await expect(
      updateMedia(actorFor(await createUser()), media.id, input, { provider }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(updateMedia(null, media.id, input, { provider })).rejects.toMatchObject({
      status: 404,
    });
    await expect(updateMedia(await admin(), media.id, input, { provider })).resolves.toBeTruthy();
  });

  it("deletes media left unattached for over 24 hours, and keeps used or recent media", async () => {
    const actor = await admin();
    const provider = createFakeMediaProvider();
    for (const name of ["old-orphan", "old-cover", "new-orphan"]) {
      provider.assets.set(`${POSTS}/${name}`, uploaded(`${POSTS}/${name}`));
    }
    const register = (name: string) =>
      registerMedia(
        actor,
        { purpose: "post", type: "IMAGE", publicId: `${POSTS}/${name}`, altText: "Alt" },
        { provider },
      );
    const oldOrphan = await register("old-orphan");
    const oldCover = await register("old-cover");
    await register("new-orphan");
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await db.mediaAsset.updateMany({
      where: { id: { in: [oldOrphan.id, oldCover.id] } },
      data: { createdAt: twoDaysAgo },
    });
    const skill = await createSkill("Crochet");
    await db.skill.update({ where: { id: skill.id }, data: { coverMediaId: oldCover.id } });

    const removed = await deleteOrphanedMedia({ provider });

    expect(removed).toBe(1);
    expect(provider.deleted).toEqual([`${POSTS}/old-orphan`]);
    expect(await db.mediaAsset.count()).toBe(2);
  });
});
