import { prisma } from "@fundz/db";
import { addressSchema } from "@fundz/shared";
import { executeSafeTransaction } from "@fundz/safe-kit";
import { createRiskSnapshot, payoutSummary } from "./risk.js";

function encodeWord(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

function encodeAddress(address: string): string {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function erc20TransferData(recipient: string, amount: bigint): `0x${string}` {
  return `0xa9059cbb${encodeAddress(recipient)}${encodeWord(amount)}`;
}

export async function requestAgentPayout(input: {
  agentId: string;
  ownerAddress: string;
}) {
  const ownerAddress = addressSchema.parse(input.ownerAddress).toLowerCase();
  const agent = await prisma.agent.findUnique({
    where: { id: input.agentId },
    include: { riskPolicy: true }
  });

  if (!agent?.safeAddress || !agent.riskPolicy?.enabled) {
    throw new Error("Agent does not have an enabled risk policy");
  }

  if (agent.ownerAddress.toLowerCase() !== ownerAddress) {
    throw new Error("Connected wallet does not own this agent");
  }

  const snapshot = await createRiskSnapshot(agent.id);
  const summary = await payoutSummary(agent.id, snapshot.totalValue, agent.riskPolicy.initialValue);
  const amount = BigInt(summary.claimable);

  if (amount <= 0n) {
    throw new Error("No claimable portfolio delta");
  }

  if (BigInt(snapshot.baseBalance) < amount) {
    throw new Error("Safe does not have enough base asset liquidity for payout");
  }

  const payout = await prisma.payout.create({
    data: {
      agentId: agent.id,
      safeAddress: agent.safeAddress,
      recipient: ownerAddress,
      baseAsset: agent.riskPolicy.baseAsset,
      amount: amount.toString(),
      profit: summary.profit,
      shareBps: summary.shareBps
    }
  });

  try {
    const result = await executeSafeTransaction({
      safeAddress: agent.safeAddress,
      to: agent.riskPolicy.baseAsset,
      data: erc20TransferData(ownerAddress, amount)
    });

    const submittedPayout = await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: "SUBMITTED",
        txHash: result.txHash,
        errorMessage: `Paid ${summary.shareBps / 100}% of positive portfolio delta`
      }
    });

    return {
      payout: submittedPayout,
      snapshot,
      claimableBeforePayout: amount.toString()
    };
  } catch (error) {
    const failedPayout = await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Payout failed"
      }
    });

    return {
      payout: failedPayout,
      snapshot,
      claimableBeforePayout: amount.toString()
    };
  }
}
