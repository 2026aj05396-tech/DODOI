import { createServer } from "node:http";

// Local stand-in for Cloudinary's Admin API during E2E runs (E2E-12). The app reaches it through
// CLOUDINARY_API_BASE (playwright.config.ts); browser uploads to api.cloudinary.com are answered by
// the tests themselves. Metadata follows the public id: ids containing "video" are 12-second
// videos, "too-long" makes a 75-second video, "missing" is not found; anything else is a
// 1600×1200 JPEG.

export const MOCK_CLOUDINARY_PORT = 3198;

function metadataFor(publicId: string, resourceType: string) {
  if (publicId.includes("missing")) return null;
  if (resourceType === "video") {
    return {
      public_id: publicId,
      resource_type: "video",
      format: "mp4",
      bytes: 4_000_000,
      width: 1080,
      height: 1920,
      duration: publicId.includes("too-long") ? 75 : 12,
    };
  }
  return {
    public_id: publicId,
    resource_type: "image",
    format: "jpg",
    bytes: 200_000,
    width: 1600,
    height: 1200,
  };
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://mock");
  // /v1_1/<cloud>/resources/<image|video>/upload[/<public id>]
  const match = /^\/v1_1\/[^/]+\/resources\/(image|video)\/upload(?:\/(.+))?$/.exec(url.pathname);
  response.setHeader("content-type", "application/json");
  if (!match) {
    response.writeHead(404).end(JSON.stringify({ error: { message: "Not found" } }));
    return;
  }
  const [, resourceType = "image", rawId] = match;
  if (request.method === "DELETE") {
    response.end(
      JSON.stringify({
        deleted: Object.fromEntries(
          url.searchParams.getAll("public_ids[]").map((id) => [id, "deleted"]),
        ),
      }),
    );
    return;
  }
  const metadata = rawId ? metadataFor(decodeURIComponent(rawId), resourceType) : null;
  if (!metadata) {
    response.writeHead(404).end(JSON.stringify({ error: { message: "Resource not found" } }));
    return;
  }
  response.end(JSON.stringify(metadata));
});

server.listen(MOCK_CLOUDINARY_PORT, "localhost", () => {
  process.stdout.write(
    `Mock Cloudinary Admin API on http://localhost:${MOCK_CLOUDINARY_PORT}/v1_1\n`,
  );
});
