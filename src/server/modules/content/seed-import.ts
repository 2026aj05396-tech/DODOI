import "server-only";

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { seedPostFileSchema, type SeedMediaFile, type SeedPostFile } from "@/lib/schemas/admin";
import type { MediaTypeName } from "@/lib/schemas/media";
import { db } from "@/server/db/client";
import { mediaProvider as defaultProvider, type MediaProvider } from "@/server/integrations/media";
import { AppError, type FieldErrors } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { recordAudit } from "@/server/modules/admin";
import { getSkillsBySlugs } from "@/server/modules/skills";
import { getUserIdByUsername } from "@/server/modules/users";

import {
  findAdminPost,
  findPostIdBySeedKey,
  findUnusedMedia,
  insertPost,
  setPostStatus,
} from "./admin-repository";
import { applyPostChanges, assertPublishable } from "./admin-service";
import {
  deleteMediaRow,
  findMediaByPublicId,
  insertMedia,
  updateMediaAltText,
} from "./media-repository";
import { checkDeclaredUpload, checkUploadedAsset, limitsFor } from "./media-rules";
import { mediaFolder } from "./media-service";
import { refreshPostSearchIndex } from "./post-service";
import { attributionProblems } from "./publish-rules";

// Seed content importer (P1-18, ADM-01…03, NFR-06). Reads `<folder>/posts/<seedKey>.json` plus
// the media files they name, and creates or updates one post per file, keyed by `seedKey`. The
// file is the source of truth: re-running updates the post to match it (PO decision, P1-18).
//
// Each file is checked completely (shape, skills, creator, attribution and licence, local media)
// before anything is uploaded or saved, so a failing file changes nothing. Media get a public id
// made from the seed key and the file's SHA-256, so an unchanged file is never uploaded twice and
// an upload interrupted half-way is picked up on the next run.

type ProviderOption = { provider?: MediaProvider };

export type SeedImportOptions = ProviderOption & {
  /** Validate only: nothing is uploaded or saved. */
  check?: boolean;
};

export type SeedImportOutcome =
  | {
      file: string;
      result: "created" | "updated";
      status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
      uploaded: number;
    }
  | { file: string; result: "checked" }
  | { file: string; result: "failed"; problems: string[] };

const FILE_TYPES: Record<string, { type: MediaTypeName; mimeType: string }> = {
  jpg: { type: "IMAGE", mimeType: "image/jpeg" },
  jpeg: { type: "IMAGE", mimeType: "image/jpeg" },
  png: { type: "IMAGE", mimeType: "image/png" },
  webp: { type: "IMAGE", mimeType: "image/webp" },
  heic: { type: "IMAGE", mimeType: "image/heic" },
  mp4: { type: "VIDEO", mimeType: "video/mp4" },
  mov: { type: "VIDEO", mimeType: "video/quicktime" },
  webm: { type: "VIDEO", mimeType: "video/webm" },
};

/** Thrown inside one file's import; becomes that file's list of problems. */
class SeedFileProblems extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join("; "));
  }
}

function fieldProblems(fields: FieldErrors): string[] {
  return Object.entries(fields).map(([field, message]) => `${field}: ${message}`);
}

type LocalMedia = {
  /** As written in the seed file. */
  path: string;
  type: MediaTypeName;
  altText: string | null;
  bytes: Buffer;
  hash: string;
};

/** Every media file the post uses (gallery and steps), each path once, read and checked. */
async function readLocalMedia(
  root: string,
  file: SeedPostFile,
): Promise<{ media: Map<string, LocalMedia>; problems: string[] }> {
  const entries: SeedMediaFile[] = [
    ...file.mediaFiles,
    ...file.steps.flatMap((step) => step.mediaFile ?? []),
  ];
  const media = new Map<string, LocalMedia>();
  const problems: string[] = [];

  for (const entry of entries) {
    const altText = entry.altText || null;
    const seen = media.get(entry.path);
    if (seen) {
      if (seen.altText !== altText) problems.push(`${entry.path}: has two different alt texts.`);
      continue;
    }
    const absolute = path.resolve(root, entry.path);
    if (!absolute.startsWith(`${root}${path.sep}`)) {
      problems.push(`${entry.path}: must be inside the seed folder.`);
      continue;
    }
    const fileType = FILE_TYPES[path.extname(entry.path).slice(1).toLowerCase()];
    if (!fileType) {
      problems.push(`${entry.path}: use JPEG, PNG, WebP, HEIC, MP4, MOV or WebM.`);
      continue;
    }
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) {
      problems.push(`${entry.path}: file not found.`);
      continue;
    }
    const declared = checkDeclaredUpload("post", fileType.type, {
      bytes: info.size,
      mimeType: fileType.mimeType,
    });
    if (declared) {
      problems.push(`${entry.path}: ${declared.message}`);
      continue;
    }
    const bytes = await readFile(absolute);
    media.set(entry.path, {
      path: entry.path,
      type: fileType.type,
      altText,
      bytes,
      hash: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return { media, problems };
}

/** Skill ids and the creator account, plus problems with them and with the attribution. */
async function resolveReferences(file: SeedPostFile) {
  const problems: string[] = [];
  const skills = await getSkillsBySlugs(file.skills);
  const unknown = file.skills.filter((slug) => !skills.has(slug));
  if (unknown.length > 0) problems.push(`skills: no skill with the slug ${unknown.join(", ")}.`);

  const authorId = file.authorUsername ? await getUserIdByUsername(file.authorUsername) : null;
  if (file.authorUsername && !authorId) {
    problems.push(`authorUsername: no dodoi account is called ${file.authorUsername}.`);
  }
  // Checked on every import, draft or not (roadmap P1-18: invalid licences are rejected).
  problems.push(...fieldProblems(attributionProblems(normalisedAttribution(file), authorId)));
  return {
    skillIds: file.skills.flatMap((slug) => skills.get(slug)?.id ?? []),
    primarySkillId: skills.get(file.primarySkill)?.id ?? null,
    authorId,
    problems,
  };
}

function normalisedAttribution(file: SeedPostFile) {
  return {
    ...file.attribution,
    originalAuthor: file.attribution.originalAuthor ?? null,
    originalUrl: file.attribution.originalUrl ?? null,
    permissionRef: file.attribution.permissionRef ?? null,
  };
}

/**
 * The media row for a local file: reused when this exact file was imported before, otherwise
 * uploaded (unless an earlier, interrupted run already did), checked like any upload and saved.
 */
async function ensureMedia(
  seedKey: string,
  local: LocalMedia,
  provider: MediaProvider,
): Promise<{ id: string; uploaded: boolean }> {
  const resourceType = local.type === "VIDEO" ? "video" : "image";
  const publicId = `${mediaFolder("post")}/seed-${seedKey}-${local.hash.slice(0, 16)}`;

  const existing = await findMediaByPublicId(publicId);
  if (existing) {
    if (existing.altText !== local.altText && local.altText) {
      await updateMediaAltText(existing.id, local.altText);
    }
    return { id: existing.id, uploaded: false };
  }

  let asset = await provider.getAsset(publicId, resourceType);
  const uploaded = !asset;
  asset ??= await provider.uploadFile({
    file: new Blob([new Uint8Array(local.bytes)]),
    fileName: path.basename(local.path),
    publicId,
    resourceType,
    allowedFormats: limitsFor("post", local.type)?.formats.join(",") ?? "",
  });
  const problem = checkUploadedAsset("post", local.type, asset);
  if (problem) {
    await provider.deleteAsset(asset.publicId, resourceType);
    throw new SeedFileProblems([`${local.path}: ${problem.message}`]);
  }
  const row = await insertMedia({
    ownerId: null,
    type: local.type,
    publicId: asset.publicId,
    format: asset.format,
    width: asset.width,
    height: asset.height,
    bytes: asset.bytes,
    durationSec: asset.durationSec,
    altText: local.altText,
  });
  return { id: row.id, uploaded };
}

/** Deletes media the post no longer uses (and nothing else uses), like deleting a post does. */
async function deleteReplacedMedia(mediaIds: string[], provider: MediaProvider): Promise<void> {
  for (const media of await findUnusedMedia(mediaIds)) {
    try {
      await provider.deleteAsset(media.publicId, media.type === "VIDEO" ? "video" : "image");
      await deleteMediaRow(media.id);
    } catch (error) {
      // Left for the daily orphan cleanup (P1-33) to retry.
      logger.error("Could not delete media replaced by a seed import", {
        mediaId: media.id,
        error,
      });
    }
  }
}

async function importFile(
  root: string,
  fileName: string,
  { provider = defaultProvider, check = false }: SeedImportOptions,
): Promise<SeedImportOutcome> {
  let json: unknown;
  try {
    json = JSON.parse(await readFile(path.join(root, "posts", fileName), "utf8"));
  } catch (error) {
    throw new SeedFileProblems([`Not valid JSON: ${(error as Error).message}`]);
  }
  const parsed = seedPostFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new SeedFileProblems(
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "file"}: ${issue.message}`),
    );
  }
  const file = parsed.data;
  if (`${file.seedKey}.json` !== fileName) {
    throw new SeedFileProblems([`seedKey: must match the file name (${fileName}).`]);
  }

  const references = await resolveReferences(file);
  const local = await readLocalMedia(root, file);
  const problems = [...references.problems, ...local.problems];
  if (problems.length > 0) throw new SeedFileProblems(problems);
  if (check) return { file: fileName, result: "checked" };

  const mediaIds = new Map<string, string>();
  let uploaded = 0;
  for (const item of local.media.values()) {
    const media = await ensureMedia(file.seedKey, item, provider);
    mediaIds.set(item.path, media.id);
    if (media.uploaded) uploaded += 1;
  }
  const idOf = (entry: SeedMediaFile) => mediaIds.get(entry.path) ?? "";

  const saved = await db.$transaction(async (tx) => {
    const existingId = await findPostIdBySeedKey(file.seedKey, tx);
    const current = existingId ? await findAdminPost(existingId, tx) : null;
    const postId =
      existingId ??
      (await insertPost(
        {
          type: file.type,
          title: file.title,
          description: file.description ?? null,
          difficulty: file.difficulty,
          estimatedMinutes: file.estimatedMinutes,
          authorId: references.authorId,
          seedKey: file.seedKey,
        },
        tx,
      ));
    await applyPostChanges(
      postId,
      {
        type: file.type,
        title: file.title,
        description: file.description ?? null,
        difficulty: file.difficulty,
        estimatedMinutes: file.estimatedMinutes,
        skillIds: references.skillIds,
        primarySkillId: references.primarySkillId,
        mediaIds: file.mediaFiles.map(idOf),
        materials: file.materials,
        steps: file.steps.map((step) => ({
          text: step.text,
          mediaId: step.mediaFile ? idOf(step.mediaFile) : null,
        })),
        attribution: file.attribution,
      },
      references.authorId,
      current,
      tx,
    );

    let status = current?.status ?? "DRAFT";
    if (file.publish) {
      await assertPublishable(postId, tx);
      if (status !== "PUBLISHED") await setPostStatus(postId, "PUBLISHED", tx);
      status = "PUBLISHED";
    } else if (status === "PUBLISHED") {
      await setPostStatus(postId, "UNPUBLISHED", tx);
      status = "UNPUBLISHED";
    }
    await recordAudit(
      {
        actorId: null,
        action: "post.seed_import",
        targetType: "post",
        targetId: postId,
        metadata: { seedKey: file.seedKey, created: !current, status },
      },
      tx,
    );
    const previousMedia = current
      ? [
          ...current.media.map((item) => item.media.id),
          ...current.steps.flatMap((step) => step.mediaId ?? []),
        ]
      : [];
    return { postId, created: !current, status, previousMedia };
  });

  await refreshPostSearchIndex(saved.postId);
  await deleteReplacedMedia(saved.previousMedia, provider);
  return {
    file: fileName,
    result: saved.created ? "created" : "updated",
    status: saved.status,
    uploaded,
  };
}

/**
 * Imports (or with `check`, only validates) every `posts/*.json` in the seed folder, in name order.
 * One file failing does not stop the others; its problems are in its outcome. A file that fails
 * after its media were uploaded leaves them unattached; the next run reuses them, otherwise the
 * daily orphan cleanup removes them.
 */
export async function importSeedContent(
  folder: string,
  options: SeedImportOptions = {},
): Promise<SeedImportOutcome[]> {
  const root = path.resolve(folder);
  const postsFolder = path.join(root, "posts");
  const names = await readdir(postsFolder).catch(() => {
    throw new Error(`No posts folder at ${postsFolder}.`);
  });

  const outcomes: SeedImportOutcome[] = [];
  for (const fileName of names.filter((name) => name.endsWith(".json")).sort()) {
    try {
      outcomes.push(await importFile(root, fileName, options));
    } catch (error) {
      if (error instanceof SeedFileProblems) {
        outcomes.push({ file: fileName, result: "failed", problems: error.problems });
      } else if (error instanceof AppError) {
        // E.g. the publish rules (POST_NOT_PUBLISHABLE) with what is missing per field.
        const details = error.fields ? fieldProblems(error.fields) : [];
        outcomes.push({ file: fileName, result: "failed", problems: [error.message, ...details] });
      } else {
        // E.g. Cloudinary or the network failing: reported, and the other files still run.
        const message = error instanceof Error ? error.message : String(error);
        outcomes.push({ file: fileName, result: "failed", problems: [message] });
      }
    }
  }
  return outcomes;
}
