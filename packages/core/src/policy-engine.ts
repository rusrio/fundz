import { prisma } from "@fundz/db";
import type { PolicyCheckCode } from "@fundz/shared";

type IntentForPolicy = {
  id: string;
  agentId: string;
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  deadline: Date;
  createdAt: Date;
};

type PolicyForEvaluation = {
  chainId: number;
  allowedTokenAddresses: string;
  maxAmountPerOperation: string;
  cooldownSeconds: number;
  dailyLimit: string;
};

type PolicyEvaluationResult = {
  approved: boolean;
  reasons: PolicyCheckCode[];
};

const approvedStatuses = ["POLICY_APPROVED", "EXECUTING", "EXECUTED"] as const;

function parseAllowedTokens(value: string): Set<string> {
  const tokens = JSON.parse(value) as string[];
  return new Set(tokens.map((token) => token.toLowerCase()));
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export async function evaluateIntentPolicy(
  intent: IntentForPolicy,
  policy: PolicyForEvaluation,
  now = new Date()
): Promise<PolicyEvaluationResult> {
  const reasons: PolicyCheckCode[] = [];
  const amountIn = BigInt(intent.amountIn);
  const allowedTokens = parseAllowedTokens(policy.allowedTokenAddresses);

  if (intent.chainId !== policy.chainId) {
    reasons.push("chain_not_allowed");
  }

  if (!allowedTokens.has(intent.tokenIn.toLowerCase()) || !allowedTokens.has(intent.tokenOut.toLowerCase())) {
    reasons.push("token_not_allowed");
  }

  if (amountIn > BigInt(policy.maxAmountPerOperation)) {
    reasons.push("amount_exceeds_max");
  }

  if (intent.deadline <= now) {
    reasons.push("deadline_expired");
  }

  if (policy.cooldownSeconds > 0) {
    const cooldownStart = new Date(now.getTime() - policy.cooldownSeconds * 1000);
    const recentApprovedIntent = await prisma.intent.findFirst({
      where: {
        agentId: intent.agentId,
        id: { not: intent.id },
        status: { in: [...approvedStatuses] },
        createdAt: { gte: cooldownStart }
      },
      orderBy: { createdAt: "desc" }
    });

    if (recentApprovedIntent) {
      reasons.push("cooldown_active");
    }
  }

  const todayStart = startOfUtcDay(now);
  const approvedToday = await prisma.intent.findMany({
    where: {
      agentId: intent.agentId,
      id: { not: intent.id },
      status: { in: [...approvedStatuses] },
      createdAt: { gte: todayStart }
    },
    select: { amountIn: true }
  });

  const spentToday = approvedToday.reduce((total, approvedIntent) => {
    return total + BigInt(approvedIntent.amountIn);
  }, 0n);

  if (spentToday + amountIn > BigInt(policy.dailyLimit)) {
    reasons.push("daily_limit_exceeded");
  }

  return {
    approved: reasons.length === 0,
    reasons
  };
}
