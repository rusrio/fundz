import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@fundz/db";
import type { Agent } from "@fundz/shared";
import { toAgent } from "./mappers.js";

const tokenPrefix = "fundz_live_";

export type AgentCredentialView = {
  id: string;
  agentId: string;
  label: string | null;
  status: "active" | "revoked";
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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

function toCredentialView(credential: {
  id: string;
  agentId: string;
  label: string | null;
  status: "ACTIVE" | "REVOKED";
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AgentCredentialView {
  return {
    id: credential.id,
    agentId: credential.agentId,
    label: credential.label,
    status: credential.status === "ACTIVE" ? "active" : "revoked",
    lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
    revokedAt: credential.revokedAt?.toISOString() ?? null,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString()
  };
}

export async function listAgentCredentials(agentId: string): Promise<AgentCredentialView[]> {
  const credentials = await prisma.agentCredential.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" }
  });

  return credentials.map(toCredentialView);
}

export async function revokeAgentCredential(input: {
  agentId: string;
  credentialId: string;
}): Promise<AgentCredentialView> {
  const credential = await prisma.agentCredential.findFirst({
    where: {
      id: input.credentialId,
      agentId: input.agentId
    }
  });

  if (!credential) {
    throw new Error("Agent credential not found");
  }

  const revokedCredential = await prisma.agentCredential.update({
    where: { id: credential.id },
    data: {
      status: "REVOKED",
      revokedAt: credential.revokedAt ?? new Date()
    }
  });

  return toCredentialView(revokedCredential);
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
