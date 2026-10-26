import type { MediaProvider, ProviderAsset, ResourceType } from "@/server/integrations/media/types";

const EXTENSION_FORMATS: Record<string, string> = { jpeg: "jpg" };

// In-memory media provider (TESTING_STRATEGY §2: fake providers). Tests put "uploaded" files in
// `assets` and check `deleted`. Server uploads are listed in `uploaded`; they report a 1200×900
// image or a 30-second video unless `uploadMetadata` has an override for that file name.
export function createFakeMediaProvider(): MediaProvider & {
  assets: Map<string, ProviderAsset>;
  deleted: string[];
  uploaded: string[];
  uploadMetadata: Map<string, Partial<ProviderAsset>>;
} {
  const assets = new Map<string, ProviderAsset>();
  const deleted: string[] = [];
  const uploaded: string[] = [];
  const uploadMetadata = new Map<string, Partial<ProviderAsset>>();
  return {
    assets,
    deleted,
    uploaded,
    uploadMetadata,
    signUpload({ folder, resourceType, allowedFormats }) {
      return {
        uploadUrl: `https://upload.test/${resourceType}`,
        apiKey: "fake-key",
        timestamp: 1_700_000_000,
        signature: "fake-signature",
        folder,
        resourceType,
        allowedFormats,
      };
    },
    async uploadFile({ file, fileName, publicId, resourceType }) {
      const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
      const asset: ProviderAsset = {
        publicId,
        resourceType,
        format: EXTENSION_FORMATS[extension] ?? extension,
        bytes: file.size,
        width: 1200,
        height: 900,
        durationSec: resourceType === "video" ? 30 : null,
        ...uploadMetadata.get(fileName),
      };
      assets.set(publicId, asset);
      uploaded.push(publicId);
      return asset;
    },
    async getAsset(publicId: string, resourceType: ResourceType) {
      const asset = assets.get(publicId);
      return asset && asset.resourceType === resourceType ? asset : null;
    },
    async deleteAsset(publicId: string) {
      assets.delete(publicId);
      deleted.push(publicId);
    },
    deliveryUrl: (publicId, resourceType) => `https://cdn.test/${resourceType}/${publicId}`,
    posterUrl: (publicId) => `https://cdn.test/poster/${publicId}.jpg`,
  };
}
