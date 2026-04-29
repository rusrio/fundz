import { prisma } from "@fundz/db";
import { type SignedIntent, type StoredIntent, signedIntentSchema } from "@fundz/shared";
import { toStoredIntent } from "./mappers.js";
import { prepareUniswapExecution } from "./execution.js";
import { evaluateIntentPolicy } from "./policy-engine.js";

export async function submitIntent(input: SignedIntent, authenticatedAgentId?: string): Promise<StoredIntent> {
  const intent = signedIntentSchema.parse(input);

  if (authenticatedAgentId && authenticatedAgentId !== intent.agentId) {
    throw new Error("Agent token does not match intent agentId");
  }

  const agent = await prisma.agent.findUnique({
    where: { id: intent.agentId },
    include: { policy: true }
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  if (!agent.policy) {
    throw new Error("Policy not found");
  }

  if (agent.status !== "ACTIVE") {
    throw new Error("Agent is disabled");
  }

  if (!agent.safeAddress) {
    throw new Error("Agent Safe is not linked");
  }

  const record = await prisma.intent.create({
    data: {
      agentId: intent.agentId,
      nonce: intent.nonce,
      action: intent.action,
      chainId: intent.chainId,
      tokenIn: intent.tokenIn,
      tokenOut: intent.tokenOut,
      amountIn: intent.amountIn,
      maxSlippageBps: intent.maxSlippageBps,
      deadline: new Date(intent.deadline),
      signature: intent.signature ?? "",
      status: "RECEIVED"
    }
  });

  const evaluation = await evaluateIntentPolicy(record, agent.policy);
  const nextStatus = evaluation.approved ? "POLICY_APPROVED" : "POLICY_REJECTED";
  const rejectionReason = evaluation.approved ? null : evaluation.reasons.join(",");

  const updatedIntent = await prisma.intent.update({
    where: { id: record.id },
    data: {
      status: nextStatus,
      rejectionReason,
      evaluation: {
        create: {
          approved: evaluation.approved,
          reasons: JSON.stringify(evaluation.reasons)
        }
      }
    }
  });

  if (evaluation.approved) {
    await prepareUniswapExecution(updatedIntent);
  }

  return toStoredIntent(updatedIntent);
}

export async function listIntents(): Promise<StoredIntent[]> {
  const intents = await prisma.intent.findMany({
    orderBy: { createdAt: "desc" }
  });

  return intents.map(toStoredIntent);
}
