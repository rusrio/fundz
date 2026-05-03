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

type RiskPolicyAgent = {
  id: string;
  safeAddress: string | null;
  policy?: {
    chainId: number;
  } | null;
};

function envValue(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

const agentProfitShareBps = 8_000;

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
  const agentLossMargin = input.agentLossMargin ?? input.maxLoss;
  const accessFee = input.accessFee ?? "0";
  const protocolCapital = input.protocolCapital ?? addAmounts(input.initialValue, `-${agentLossMargin}`, `-${accessFee}`);
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

async function safeInitialValue(input: {
  baseAsset: string;
  riskAsset: string;
  safeAddress: string | null;
  chainId: number;
  emergencySlippageBps: number;
}): Promise<string | null> {
  const { baseAsset, riskAsset, safeAddress, chainId, emergencySlippageBps } = input;

  if (!safeAddress) {
    return null;
  }

  try {
    const [baseBalance, riskBalance] = await Promise.all([
      tokenBalance(baseAsset, safeAddress),
      tokenBalance(riskAsset, safeAddress)
    ]);
    const riskValue = BigInt(riskBalance) > 0n
      ? (await getUniswapQuote({
        chainId,
        tokenIn: riskAsset,
        tokenOut: baseAsset,
        amountIn: riskBalance,
        maxSlippageBps: emergencySlippageBps,
        swapper: safeAddress
      })).amountOut ?? "0"
      : "0";

    return (BigInt(baseBalance) + BigInt(riskValue)).toString();
  } catch {
    return null;
  }
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

async function claimedPayoutAmount(agentId: string): Promise<bigint> {
  const payouts = await prisma.payout.findMany({
    where: {
      agentId,
      status: {
        in: ["PENDING", "SUBMITTED", "CONFIRMED"]
      }
    },
    select: { amount: true }
  });

  return payouts.reduce((sum, payout) => sum + BigInt(payout.amount), 0n);
}

async function receivedPayoutAmount(agentId: string): Promise<bigint> {
  const payouts = await prisma.payout.findMany({
    where: {
      agentId,
      status: {
        in: ["SUBMITTED", "CONFIRMED"]
      }
    },
    select: { amount: true }
  });

  return payouts.reduce((sum, payout) => sum + BigInt(payout.amount), 0n);
}

export async function payoutSummary(agentId: string, totalValue: string, initialValue: string) {
  const profit = BigInt(totalValue) - BigInt(initialValue);
  const positiveProfit = profit > 0n ? profit : 0n;
  const grossClaimable = (positiveProfit * BigInt(agentProfitShareBps)) / 10_000n;
  const [claimed, received] = await Promise.all([
    claimedPayoutAmount(agentId),
    receivedPayoutAmount(agentId)
  ]);
  const claimable = grossClaimable > claimed ? grossClaimable - claimed : 0n;

  return {
    profit: positiveProfit.toString(),
    claimable: claimable.toString(),
    claimed: claimed.toString(),
    received: received.toString(),
    shareBps: agentProfitShareBps
  };
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

export async function upsertDefaultRiskPolicyForAgent(agent: RiskPolicyAgent) {
  const baseAsset = envValue("DEMO_TOKEN_IN", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  const riskAsset = envValue("DEMO_TOKEN_OUT", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  const agentLossMargin = envValue("AGENT_LOSS_MARGIN", "10000000000");
  const accessFee = envValue("AGENT_ACCESS_FEE", "1000000000");
  const chainId = agent.policy?.chainId ?? 1;
  const emergencySlippageBps = Number(envValue("RISK_EMERGENCY_SLIPPAGE_BPS", "100"));
  const configuredProtocolCapital = process.env.FUNDZ_PROTOCOL_CAPITAL;
  const defaultProtocolCapital = configuredProtocolCapital && configuredProtocolCapital.length > 0
    ? configuredProtocolCapital
    : "89000000000";
  const fallbackInitialValue = envValue("DEMO_SAFE_TOKEN_BALANCE", addAmounts(defaultProtocolCapital, agentLossMargin, accessFee));
  const initialValue = process.env.RISK_INITIAL_VALUE && process.env.RISK_INITIAL_VALUE.length > 0
    ? process.env.RISK_INITIAL_VALUE
    : await safeInitialValue({
      baseAsset,
      riskAsset,
      safeAddress: agent.safeAddress,
      chainId,
      emergencySlippageBps
    }) ?? fallbackInitialValue;

  return upsertRiskPolicy({
    agentId: agent.id,
    chainId,
    baseAsset,
    riskAsset,
    protocolCapital: configuredProtocolCapital && configuredProtocolCapital.length > 0 ? configuredProtocolCapital : undefined,
    agentLossMargin,
    accessFee,
    initialValue,
    maxLoss: envValue("RISK_MAX_LOSS", agentLossMargin),
    minValue: envValue("RISK_MIN_VALUE", addAmounts(
      configuredProtocolCapital && configuredProtocolCapital.length > 0
        ? configuredProtocolCapital
        : addAmounts(initialValue, `-${agentLossMargin}`, `-${accessFee}`),
      accessFee
    )),
    emergencySlippageBps,
    pollSeconds: Math.max(1, Math.floor(Number(envValue("RISK_MONITOR_INTERVAL_MS", "10000")) / 1000))
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

export async function monitorAllRiskPoliciesOnce() {
  const policies = await prisma.riskPolicy.findMany({
    where: { enabled: true },
    select: { agentId: true }
  });

  return Promise.all(policies.map((policy) => monitorRiskOnce(policy.agentId)));
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
    const payout = await payoutSummary(policy.agentId, totalValue, policy.initialValue);

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
      initialValue: policy.initialValue,
      totalValue,
      lossBufferRemaining,
      claimablePayout: payout.claimable,
      claimedPayout: payout.claimed,
      totalPayoutReceived: payout.received,
      payoutShareBps: payout.shareBps,
      breached: latestSnapshot?.breached ?? false,
      latestSnapshot,
      latestEvent
    };
  }));
}
