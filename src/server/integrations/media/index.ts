import "server-only";

import { serverEnv } from "@/server/lib/env";

import { createCloudinaryProvider } from "./cloudinary";
import type { MediaProvider } from "./types";

export type {
  MediaProvider,
  ProviderAsset,
  ResourceType,
  SignedUploadParams,
  SignUploadParams,
  UploadFileParams,
} from "./types";

export const mediaProvider: MediaProvider = createCloudinaryProvider({
  cloudName: serverEnv.CLOUDINARY_CLOUD_NAME,
  apiKey: serverEnv.CLOUDINARY_API_KEY,
  apiSecret: serverEnv.CLOUDINARY_API_SECRET,
  adminApiBase: serverEnv.CLOUDINARY_API_BASE,
});
