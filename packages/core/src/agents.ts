import { prisma } from "@fundz/db";
import { linkExistingSafe } from "@fundz/safe-kit";
import {
  type Agent,
  type Policy,
  type RegisterAgentRequest,
  registerAgentRequestSchema
} from "@fundz/shared";
import { toAgent, toPolicy } from "./mappers.js";

function envValue(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

const defaultAllowedTokens = [
  envValue("DEMO_TOKEN_IN", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  envValue("DEMO_TOKEN_OUT", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
];

const defaultPolicy = {
  chainId: 1,
  allowedTokenAddresses: JSON.stringify(defaultAllowedTokens),
  maxAmountPerOperation: envValue("DEMO_MAX_AMOUNT_PER_OPERATION", "1000000000"),
  cooldownSeconds: 60,
  dailyLimit: envValue("DEMO_DAILY_LIMIT", "5000000000")
};

export async function registerAgent(input: RegisterAgentRequest): Promise<{
  agent: Agent;
  policy: Policy;
}> {
  const request = registerAgentRequestSchema.parse(input);

  const agent = await prisma.agent.upsert({
    where: { ownerAddress: request.ownerAddress },
    update: {
      name: request.name,
      safeAddress: request.safeAddress
    },
    create: {
      name: request.name,
      ownerAddress: request.ownerAddress,
      safeAddress: request.safeAddress
    }
  });

  const policy = await prisma.policy.upsert({
    where: { agentId: agent.id },
    update: {},
    create: {
      agentId: agent.id,
      ...defaultPolicy
    }
  });

  return {
    agent: toAgent(agent),
    policy: toPolicy(policy)
  };
}

export async function authenticateAgent(ownerAddress: string): Promise<Agent | null> {
  const agent = await prisma.agent.findUnique({
    where: { ownerAddress }
  });

  return agent ? toAgent(agent) : null;
}

export async function listAgents(): Promise<Agent[]> {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "desc" }
  });

  return agents.map(toAgent);
}

export async function linkAgentSafe(input: { agentId: string; safeAddress: string }): Promise<Agent> {
  const safe = linkExistingSafe(input);

  const agent = await prisma.agent.update({
    where: { id: safe.agentId },
    data: { safeAddress: safe.safeAddress }
  });

  return toAgent(agent);
}

export async function getAgentSafe(agentId: string): Promise<{ agentId: string; safeAddress: string } | null> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, safeAddress: true }
  });

  if (!agent?.safeAddress) {
    return null;
  }

  return {
    agentId: agent.id,
    safeAddress: agent.safeAddress
  };
}
