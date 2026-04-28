import { prisma } from "@fundz/db";
import { executeSafeTransaction, hasSafeExecutorConfig } from "@fundz/safe-kit";
import { createUniswapSwapTransaction, getUniswapQuote } from "@fundz/uniswap-adapter";
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
  deadline: Date;
};

function safeExecutionGasLimit(gasLimit: string | null): string | undefined {
  const override = process.env.SAFE_EXECUTION_GAS_LIMIT;

  if (override && /^[0-9]+$/.test(override)) {
    return override;
  }

  return gasLimit ?? undefined;
}

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
        errorMessage: hasSafeExecutorConfig()
          ? `Quote prepared by Uniswap request ${quote.requestId}; requesting swap calldata`
          : `Quote prepared by Uniswap request ${quote.requestId}; Safe executor not configured`
      }
    });

    if (!hasSafeExecutorConfig()) {
      return toExecution(execution);
    }

    try {
      const swap = await createUniswapSwapTransaction(quote, {
        deadline: Math.floor(intent.deadline.getTime() / 1000)
      });

      const safeResult = await executeSafeTransaction({
        safeAddress: agent.safeAddress,
        to: swap.to,
        value: swap.value,
        data: swap.data,
        options: {
          gasLimit: safeExecutionGasLimit(swap.gasLimit),
          gasPrice: swap.gasPrice ?? undefined,
          maxFeePerGas: swap.maxFeePerGas ?? undefined,
          maxPriorityFeePerGas: swap.maxPriorityFeePerGas ?? undefined
        }
      });

      const submittedExecution = await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: "SUBMITTED",
          txHash: safeResult.txHash,
          errorMessage: `Uniswap swap ${swap.requestId} submitted through Safe`
        }
      });

      return toExecution(submittedExecution);
    } catch (safeError) {
      const message = safeError instanceof Error ? safeError.message : "Safe execution failed";
      const failedExecution = await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          errorMessage: message
        }
      });

      return toExecution(failedExecution);
    }
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
