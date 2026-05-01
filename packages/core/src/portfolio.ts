import { prisma } from "@fundz/db";
import { getUniswapQuote } from "@fundz/uniswap-adapter";

type RpcCall = {
  to: string;
  data: `0x${string}`;
};

const defaultTokens = [
  {
    symbol: "USDC",
    address: process.env.DEMO_TOKEN_IN ?? "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6
  },
  {
    symbol: "WETH",
    address: process.env.DEMO_TOKEN_OUT ?? "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18
  },
  {
    symbol: "WBTC",
    address: process.env.DEMO_TOKEN_WBTC ?? "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8
  },
  {
    symbol: "UNI",
    address: process.env.DEMO_TOKEN_UNI ?? "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18
  }
];

function balanceOfData(address: string): `0x${string}` {
  return `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}`;
}

function rpcUrl(): string {
  const url = process.env.SAFE_RPC_URL ?? process.env.TENDERLY_VNET_RPC_URL;

  if (!url) {
    throw new Error("SAFE_RPC_URL or TENDERLY_VNET_RPC_URL is required for portfolio balances");
  }

  return url;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl(), {
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

function uniqueAddresses(addresses: string[]): string[] {
  return [...new Set(addresses.map((address) => address.toLowerCase()))];
}

function tokenMeta(address: string) {
  const token = defaultTokens.find((candidate) => candidate.address.toLowerCase() === address.toLowerCase());

  return {
    symbol: token?.symbol ?? `${address.slice(0, 6)}...${address.slice(-4)}`,
    address,
    decimals: token?.decimals ?? 18
  };
}

function parseAllowedTokens(value: string | null | undefined): string[] {
  if (!value) {
    return defaultTokens.map((token) => token.address);
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : defaultTokens.map((token) => token.address);
  } catch {
    return defaultTokens.map((token) => token.address);
  }
}

export async function listPortfolioDashboardStates() {
  const agents = await prisma.agent.findMany({
    include: {
      policy: true,
      riskPolicy: true
    },
    orderBy: { createdAt: "desc" }
  });

  return Promise.all(agents.map(async (agent) => {
    const baseAsset = agent.riskPolicy?.baseAsset ?? defaultTokens[0]!.address;
    const chainId = agent.riskPolicy?.chainId ?? agent.policy?.chainId ?? 1;
    const allowedTokens = uniqueAddresses([
      baseAsset,
      ...parseAllowedTokens(agent.policy?.allowedTokenAddresses)
    ]);

    if (!agent.safeAddress) {
      return {
        agentId: agent.id,
        safeAddress: null,
        baseAsset,
        totalValue: "0",
        pnl: "0",
        pnlBps: 0,
        drawdown: "0",
        positions: allowedTokens.map((address) => ({
          ...tokenMeta(address),
          balance: "0",
          valueInBase: "0"
        })),
        error: "Safe is not linked"
      };
    }

    try {
      const positions = await Promise.all(allowedTokens.map(async (address) => {
        const balance = await tokenBalance(address, agent.safeAddress!);
        const isBaseAsset = address.toLowerCase() === baseAsset.toLowerCase();
        const valueInBase = isBaseAsset || BigInt(balance) === 0n
          ? balance
          : (await getUniswapQuote({
            chainId,
            tokenIn: address,
            tokenOut: baseAsset,
            amountIn: balance,
            maxSlippageBps: agent.riskPolicy?.emergencySlippageBps ?? 100,
            swapper: agent.safeAddress!
          })).amountOut ?? "0";

        return {
          ...tokenMeta(address),
          balance,
          valueInBase
        };
      }));
      const totalValue = positions.reduce((sum, position) => sum + BigInt(position.valueInBase), 0n);
      const initialValue = BigInt(agent.riskPolicy?.initialValue ?? totalValue.toString());
      const pnl = totalValue - initialValue;
      const drawdown = pnl < 0n ? -pnl : 0n;
      const pnlBps = initialValue > 0n ? Number((pnl * 10000n) / initialValue) : 0;

      return {
        agentId: agent.id,
        safeAddress: agent.safeAddress,
        baseAsset,
        totalValue: totalValue.toString(),
        pnl: pnl.toString(),
        pnlBps,
        drawdown: drawdown.toString(),
        positions,
        error: null
      };
    } catch (error) {
      return {
        agentId: agent.id,
        safeAddress: agent.safeAddress,
        baseAsset,
        totalValue: "0",
        pnl: "0",
        pnlBps: 0,
        drawdown: "0",
        positions: allowedTokens.map((address) => ({
          ...tokenMeta(address),
          balance: "0",
          valueInBase: "0"
        })),
        error: error instanceof Error ? error.message : "Portfolio valuation failed"
      };
    }
  }));
}
