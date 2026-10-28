import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createSerwistRoute } from "@serwist/turbopack";

import { OFFLINE_PATH } from "@/lib/constants/offline";

// Builds the service worker (src/app/sw.ts) with its precache list at build time and serves it at
// /serwist/sw.js (P1-27). The offline page is precached with the commit as its revision, so a new
// release replaces it.
// Vercel builds without a .git folder but names the commit in VERCEL_GIT_COMMIT_SHA.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: "src/app/sw.ts",
    additionalPrecacheEntries: [{ url: OFFLINE_PATH, revision }],
    useNativeEsbuild: true,
  },
);
