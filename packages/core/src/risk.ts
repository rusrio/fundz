import { prisma } from "@fundz/db";
import { createUniswapSwapTransaction, getUniswapQuote } from "@fundz/uniswap-adapter";
import { executeSafeTransaction } from "@fundz/safe-kit";
import { revokeAgentCredential } from "./credentials.js";

type RpcCall = {
  to: string;
  data: `0x${string}`;
};

type RiskConfig = {
  agentId: string;
  chainId: number;
  baseAsset: string;
  riskAsset: string;
  protocolCapital?: string;
  agentLossMargin?: string;
  accessFee?: string;
  initialValue: string;
  maxLoss: string;
  minValue: string;
  emergencySlippageBps: number;
  pollSeconds?: number;
};

function balanceOfData(address: string): `0x${string}` {
  return `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}`;
}

function safeExecutionGasLimit(gasLimit: string | null): string | undefined {
  const override = process.env.SAFE_EXECUTION_GAS_LIMIT;
  return override && /^[0-9]+$/.test(override) ? override : gasLimit ?? undefined;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const rpcUrl = process.env.SAFE_RPC_URL ?? process.env.TENDERLY_VNET_RPC_URL;

  if (!rpcUrl) {
    throw new Error("SAFE_RPC_URL or TENDERLY_VNET_RPC_URL is required");
  }

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });
  const body = (await response.json()) as { result?: T; error?: { message?: string } };

  if (!response.ok || body.error) {
    throw new Error(`${method} failed: ${body.error?.message ?? response.statusText}`);
  }

  return body.result as T;
}

function addAmounts(...amounts: string[]): string {
  return amounts.reduce((sum, amount) => sum + BigInt(amount), 0n).toString();
}

function riskBudget(input: RiskConfig) {
  const protocolCapital = input.protocolCapital ?? addAmounts(input.initialValue, `-${input.maxLoss}`);
  const agentLossMargin = input.agentLossMargin ?? input.maxLoss;
  const accessFee = input.accessFee ?? "0";
  const protectedValue = addAmounts(protocolCapital, accessFee);

  return {
    protocolCapital,
    agentLossMargin,
    accessFee,
    protectedValue,
    initialValue: addAmounts(protocolCapital, agentLossMargin, accessFee),
    maxLoss: agentLossMargin,
    minValue: protectedValue
  };
}

async function tokenBalance(token: string, owner: string): Promise<string> {
  const result = await rpc<string>("eth_call", [
    {
      to: token,
      data: balanceOfData(owner)
    } satisfies RpcCall,
    "latest"
  ]);

  return BigInt(result).toString();
}

export async function upsertRiskPolicy(input: RiskConfig) {
  const budget = riskBudget(input);

  return prisma.riskPolicy.upsert({
    where: { agentId: input.agentId },
    update: {
      enabled: true,
      chainId: input.chainId,
      baseAsset: input.baseAsset,
      riskAsset: input.riskAsset,
      protocolCapital: budget.protocolCapital,
      agentLossMargin: budget.agentLossMargin,
      accessFee: budget.accessFee,
      protectedValue: budget.protectedValue,
      initialValue: budget.initialValue,
      maxLoss: budget.maxLoss,
      minValue: budget.minValue,
      emergencySlippageBps: input.emergencySlippageBps,
      ...(input.pollSeconds ? { pollSeconds: input.pollSeconds } : {})
    },
    create: {
      agentId: input.agentId,
      enabled: true,
      chainId: input.chainId,
      baseAsset: input.baseAsset,
      riskAsset: input.riskAsset,
      protocolCapital: budget.protocolCapital,
      agentLossMargin: budget.agentLossMargin,
      accessFee: budget.accessFee,
      protectedValue: budget.protectedValue,
      initialValue: budget.initialValue,
      maxLoss: budget.maxLoss,
      minValue: budget.minValue,
      emergencySlippageBps: input.emergencySlippageBps,
      ...(input.pollSeconds ? { pollSeconds: input.pollSeconds } : {})
    }
  });
}

export async function createRiskSnapshot(agentId: string) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { riskPolicy: true }
  });

  if (!agent?.safeAddress) {
    throw new Error("Agent Safe is not linked");
  }

  if (!agent.riskPolicy?.enabled) {
    throw new Error("Risk policy is not enabled");
  }

  const policy = agent.riskPolicy;
  const [baseBalance, riskBalance] = await Promise.all([
    tokenBalance(policy.baseAsset, agent.safeAddress),
    tokenBalance(policy.riskAsset, agent.safeAddress)
  ]);
  const quote = BigInt(riskBalance) > 0n
    ? await getUniswapQuote({
      chainId: policy.chainId,
      tokenIn: policy.riskAsset,
      tokenOut: policy.baseAsset,
      amountIn: riskBalance,
      maxSlippageBps: policy.emergencySlippageBps,
      swapper: agent.safeAddress
    })
    : null;
  const riskValue = quote?.amountOut ?? "0";
  const totalValue = (BigInt(baseBalance) + BigInt(riskValue)).toString();
  const breached = BigInt(totalValue) <= BigInt(policy.minValue);

  return prisma.riskSnapshot.create({
    data: {
      agentId,
      safeAddress: agent.safeAddress,
      baseAsset: policy.baseAsset,
      riskAsset: policy.riskAsset,
      baseBalance,
      riskBalance,
      riskValue,
      totalValue,
      minValue: policy.minValue,
      breached
    }
  });
}

export async function handleRiskBreach(agentId: string, snapshotId: string) {
  const snapshot = await prisma.riskSnapshot.findUnique({
    where: { id: snapshotId },
    include: { agent: { include: { riskPolicy: true, credentials: true } } }
  });

  if (!snapshot?.agent.safeAddress || !snapshot.agent.riskPolicy) {
    throw new Error("Risk snapshot is missing agent policy context");
  }

  const event = await prisma.riskEvent.create({
    data: {
      agentId,
      snapshotId,
      reason: `Portfolio value ${snapshot.totalValue} breached minimum ${snapshot.minValue}`
    }
  });

  try {
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: "DISABLED" }
    });

    await Promise.all(snapshot.agent.credentials
      .filter((credential) => credential.status === "ACTIVE")
      .map((credential) => revokeAgentCredential({ agentId, credentialId: credential.id })));

    if (BigInt(snapshot.riskBalance) > 0n) {
      const quote = await getUniswapQuote({
        chainId: snapshot.agent.riskPolicy.chainId,
        tokenIn: snapshot.riskAsset,
        tokenOut: snapshot.baseAsset,
        amountIn: snapshot.riskBalance,
        maxSlippageBps: snapshot.agent.riskPolicy.emergencySlippageBps,
        swapper: snapshot.safeAddress
      });
      const swap = await createUniswapSwapTransaction(quote, {
        deadline: Math.floor(Date.now() / 1000) + 30 * 60
      });
      const result = await executeSafeTransaction({
        safeAddress: snapshot.safeAddress,
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

      return prisma.riskEvent.update({
        where: { id: event.id },
        data: {
          status: "RESOLVED",
          emergencyTxHash: result.txHash
        }
      });
    }

    return prisma.riskEvent.update({
      where: { id: event.id },
      data: { status: "RESOLVED" }
    });
  } catch (error) {
    return prisma.riskEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Risk breach handling failed"
      }
    });
  }
}

export async function monitorRiskOnce(agentId: string) {
  const snapshot = await createRiskSnapshot(agentId);

  if (!snapshot.breached) {
    return { snapshot, event: null };
  }

  const existingOpenEvent = await prisma.riskEvent.findFirst({
    where: {
      agentId,
      status: "TRIGGERED"
    },
    orderBy: { createdAt: "desc" }
  });

  if (existingOpenEvent) {
    return { snapshot, event: existingOpenEvent };
  }

  const event = await handleRiskBreach(agentId, snapshot.id);
  return { snapshot, event };
}

export async function listRiskDashboardStates() {
  const policies = await prisma.riskPolicy.findMany({
    include: {
      agent: true
    },
    orderBy: { updatedAt: "desc" }
  });

  return Promise.all(policies.map(async (policy) => {
    const [latestSnapshot, latestEvent] = await Promise.all([
      prisma.riskSnapshot.findFirst({
        where: { agentId: policy.agentId },
        orderBy: { createdAt: "desc" }
      }),
      prisma.riskEvent.findFirst({
        where: { agentId: policy.agentId },
        orderBy: { createdAt: "desc" }
      })
    ]);
    const totalValue = latestSnapshot?.totalValue ?? policy.initialValue;
    const lossBufferRemaining = BigInt(totalValue) > BigInt(policy.protectedValue)
      ? (BigInt(totalValue) - BigInt(policy.protectedValue)).toString()
      : "0";

    return {
      agentId: policy.agentId,
      agentName: policy.agent.name,
      safeAddress: policy.agent.safeAddress,
      enabled: policy.enabled,
      baseAsset: policy.baseAsset,
      riskAsset: policy.riskAsset,
      protocolCapital: policy.protocolCapital,
      agentLossMargin: policy.agentLossMargin,
      accessFee: policy.accessFee,
      protectedValue: policy.protectedValue,
      totalValue,
      lossBufferRemaining,
      breached: latestSnapshot?.breached ?? false,
      latestSnapshot,
      latestEvent
    };
  }));
}
