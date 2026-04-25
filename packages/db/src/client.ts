import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  fundzPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.fundzPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.fundzPrisma = prisma;
}
