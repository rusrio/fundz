import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@fundz/db";
import type { Agent } from "@fundz/shared";
import { toAgent } from "./mappers.js";

const tokenPrefix = "fundz_live_";

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function verifyTokenHash(token: string, tokenHash: string): boolean {
  const candidate = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(tokenHash, "hex");

  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createAgentToken(): string {
  return `${tokenPrefix}${randomBytes(32).toString("base64url")}`;
}

export async function issueAgentCredential(input: {
  agentId: string;
  label?: string;
  token?: string;
}): Promise<{ token: string; credentialId: string }> {
  const token = input.token ?? createAgentToken();
  const credential = await prisma.agentCredential.create({
    data: {
      agentId: input.agentId,
      label: input.label,
      tokenHash: hashToken(token)
    }
  });

  return {
    token,
    credentialId: credential.id
  };
}

export async function authenticateAgentToken(token: string): Promise<Agent> {
  const credentials = await prisma.agentCredential.findMany({
    where: { status: "ACTIVE" },
    include: { agent: true }
  });

  const credential = credentials.find((candidate) => verifyTokenHash(token, candidate.tokenHash));

  if (!credential) {
    throw new Error("Invalid agent token");
  }

  if (credential.agent.status !== "ACTIVE") {
    throw new Error("Agent is disabled");
  }

  await prisma.agentCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() }
  });

  return toAgent(credential.agent);
}
