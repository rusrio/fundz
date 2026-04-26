import { prisma } from "@fundz/db";
import { getUniswapQuote } from "@fundz/uniswap-adapter";
import type { Execution } from "@fundz/shared";
import { toExecution } from "./mappers.js";

type ApprovedIntent = {
  id: string;
  agentId: string;
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
};

export async function prepareUniswapExecution(intent: ApprovedIntent): Promise<Execution> {
  const agent = await prisma.agent.findUnique({
    where: { id: intent.agentId },
    select: { safeAddress: true }
  });

  if (!agent?.safeAddress) {
    const execution = await prisma.execution.create({
      data: {
        intentId: intent.id,
        agentId: intent.agentId,
        safeAddress: "0x0000000000000000000000000000000000000000",
        adapter: "uniswap",
        status: "PENDING",
        amountIn: intent.amountIn,
        errorMessage: "Agent Safe is not linked; Uniswap quote was not requested"
      }
    });

    return toExecution(execution);
  }

  try {
    const quote = await getUniswapQuote({
      chainId: intent.chainId,
      tokenIn: intent.tokenIn,
      tokenOut: intent.tokenOut,
      amountIn: intent.amountIn,
      maxSlippageBps: intent.maxSlippageBps,
      swapper: agent.safeAddress
    });

    const execution = await prisma.execution.create({
      data: {
        intentId: intent.id,
        agentId: intent.agentId,
        safeAddress: agent.safeAddress,
        adapter: "uniswap",
        status: "PENDING",
        amountIn: intent.amountIn,
        amountOut: quote.amountOut,
        errorMessage: `Quote prepared by Uniswap request ${quote.requestId}; Safe execution not submitted yet`
      }
    });

    return toExecution(execution);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Uniswap quote failed";
    const execution = await prisma.execution.create({
      data: {
        intentId: intent.id,
        agentId: intent.agentId,
        safeAddress: agent.safeAddress,
        adapter: "uniswap",
        status: "PENDING",
        amountIn: intent.amountIn,
        errorMessage: message
      }
    });

    return toExecution(execution);
  }
}

export async function listExecutions(): Promise<Execution[]> {
  const executions = await prisma.execution.findMany({
    orderBy: { createdAt: "desc" }
  });

  return executions.map(toExecution);
}
