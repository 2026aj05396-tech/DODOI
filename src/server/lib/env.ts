import "server-only";

import { z } from "zod";

// Single place that reads process.env on the server (CODE_QUALITY §2.5). Extended in P0-07.
const serverEnvSchema = z.object({
  // Deployed environment (SYSTEM_ARCHITECTURE §13). Independent of NODE_ENV.
  APP_ENV: z.enum(["local", "test", "production"]),
  DATABASE_URL: z.url(),
});

export const serverEnv = serverEnvSchema.parse(process.env);
