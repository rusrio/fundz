import { prisma } from "@fundz/db";
import type { Policy } from "@fundz/shared";
import { toPolicy } from "./mappers.js";

export async function getPolicy(agentId: string): Promise<Policy | null> {
  const policy = await prisma.policy.findUnique({
    where: { agentId }
  });

  return policy ? toPolicy(policy) : null;
}
