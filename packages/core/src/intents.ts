import { prisma } from "@fundz/db";
import { type SignedIntent, type StoredIntent, signedIntentSchema } from "@fundz/shared";
import { toStoredIntent } from "./mappers.js";

export async function submitIntent(input: SignedIntent): Promise<StoredIntent> {
  const intent = signedIntentSchema.parse(input);

  const agent = await prisma.agent.findUnique({
    where: { id: intent.agentId }
  });

  if (!agent) {
    throw new Error("Agent not found");
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
      signature: intent.signature,
      status: "RECEIVED"
    }
  });

  return toStoredIntent(record);
}

export async function listIntents(): Promise<StoredIntent[]> {
  const intents = await prisma.intent.findMany({
    orderBy: { createdAt: "desc" }
  });

  return intents.map(toStoredIntent);
}
