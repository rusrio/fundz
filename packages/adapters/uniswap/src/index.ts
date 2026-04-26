export type UniswapQuoteRequest = {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
  swapper: string;
};

export type UniswapPreparedSwap = {
  requestId: string;
  routing: string | null;
  amountOut: string | null;
  quote: unknown;
};

const defaultBaseUrl = "https://trade-api.gateway.uniswap.org/v1";

function getNestedString(value: unknown, path: string[]): string | null {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : null;
}

export function hasUniswapApiKey(): boolean {
  return Boolean(process.env.UNISWAP_API_KEY);
}

export async function getUniswapQuote(
  request: UniswapQuoteRequest,
  options: { apiKey?: string; baseUrl?: string } = {}
): Promise<UniswapPreparedSwap> {
  const apiKey = options.apiKey ?? process.env.UNISWAP_API_KEY;

  if (!apiKey) {
    throw new Error("UNISWAP_API_KEY is not configured");
  }

  const response = await fetch(`${options.baseUrl ?? defaultBaseUrl}/quote`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "x-universal-router-version": "2.0"
    },
    body: JSON.stringify({
      type: "EXACT_INPUT",
      amount: request.amountIn,
      tokenInChainId: request.chainId,
      tokenOutChainId: request.chainId,
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
      swapper: request.swapper,
      slippageTolerance: request.maxSlippageBps / 100,
      routingPreference: "BEST_PRICE",
      protocols: ["V2", "V3", "V4"],
      urgency: "urgent"
    })
  });

  const body = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(`Uniswap quote failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return {
    requestId: getNestedString(body, ["requestId"]) ?? "unknown",
    routing: getNestedString(body, ["routing"]),
    amountOut: getNestedString(body, ["quote", "output", "amount"]),
    quote: body
  };
}
