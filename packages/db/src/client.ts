import { PrismaClient } from "@prisma/client";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL) {
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  process.env.DATABASE_URL = `file:${join(packageRoot, "prisma", "dev.db")}`;
}

const globalForPrisma = globalThis as unknown as {
  fundzPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.fundzPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.fundzPrisma = prisma;
}
