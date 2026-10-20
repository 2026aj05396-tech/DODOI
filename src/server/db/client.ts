import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/server/lib/env";

function createPrismaClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: serverEnv.DATABASE_URL }) });
}

// Reuse one client across hot reloads in development to avoid exhausting connections.
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
