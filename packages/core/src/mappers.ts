import type { Agent, Policy, StoredIntent } from "@fundz/shared";

type AgentRecord = {
  id: string;
  name: string;
  ownerAddress: string;
  safeAddress: string | null;
  status: "ACTIVE" | "DISABLED";
  createdAt: Date;
  updatedAt: Date;
};

type PolicyRecord = {
  id: string;
  agentId: string;
  chainId: number;
  allowedTokenAddresses: string;
  maxAmountPerOperation: string;
  cooldownSeconds: number;
  dailyLimit: string;
  createdAt: Date;
  updatedAt: Date;
};

type IntentRecord = {
  id: string;
  agentId: string;
  nonce: string;
  action: string;
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
  deadline: Date;
  signature: string;
  status:
    | "RECEIVED"
    | "POLICY_APPROVED"
    | "POLICY_REJECTED"
    | "EXECUTING"
    | "EXECUTED"
    | "FAILED";
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const agentStatusMap = {
  ACTIVE: "active",
  DISABLED: "disabled"
} as const;

const intentStatusMap = {
  RECEIVED: "received",
  POLICY_APPROVED: "policy_approved",
  POLICY_REJECTED: "policy_rejected",
  EXECUTING: "executing",
  EXECUTED: "executed",
  FAILED: "failed"
} as const;

export function toIsoDate(value: Date): string {
  return value.toISOString();
}

export function toAgent(record: AgentRecord): Agent {
  return {
    id: record.id,
    name: record.name,
    ownerAddress: record.ownerAddress,
    safeAddress: record.safeAddress,
    status: agentStatusMap[record.status],
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt)
  };
}

export function toPolicy(record: PolicyRecord): Policy {
  return {
    id: record.id,
    agentId: record.agentId,
    chainId: record.chainId,
    allowedTokenAddresses: JSON.parse(record.allowedTokenAddresses) as string[],
    maxAmountPerOperation: record.maxAmountPerOperation,
    cooldownSeconds: record.cooldownSeconds,
    dailyLimit: record.dailyLimit,
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt)
  };
}

export function toStoredIntent(record: IntentRecord): StoredIntent {
  return {
    id: record.id,
    agentId: record.agentId,
    nonce: record.nonce,
    action: "uniswap.swap",
    chainId: record.chainId,
    tokenIn: record.tokenIn,
    tokenOut: record.tokenOut,
    amountIn: record.amountIn,
    maxSlippageBps: record.maxSlippageBps,
    deadline: toIsoDate(record.deadline),
    signature: record.signature,
    status: intentStatusMap[record.status],
    rejectionReason: record.rejectionReason,
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt)
  };
}
