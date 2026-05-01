import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createUniswapSwapTransaction, getUniswapQuote } from "../packages/adapters/uniswap/src/index.js";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const universalRouterAddress = "0x66a9893cc07d91d95644aedd05d03f95e1dba8af";
const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const maxUint256 = (1n << 256n) - 1n;
const maxUint160 = (1n << 160n) - 1n;
const maxUint48 = (1n << 48n) - 1n;

function loadRepoEnv() {
  const envPath = resolve(repoRoot, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");

    process.env[key] ??= value;
  }
}

function env(name: string, fallback?: string): string {
  const value = process.env[name] && process.env[name]!.length > 0 ? process.env[name] : fallback;

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function envAddress(name: string, fallback?: string): string {
  const value = env(name, fallback);

  if (!addressPattern.test(value)) {
    throw new Error(`${name} must be an EVM address`);
  }

  return value;
}

function rpcUrl(): string {
  return env("TENDERLY_VNET_RPC_URL", process.env.SAFE_RPC_URL);
}

function amountToHex(value: string): `0x${string}` {
  if (/^0x[a-fA-F0-9]+$/.test(value)) {
    return value as `0x${string}`;
  }

  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`Amount must be a decimal integer or hex value: ${value}`);
  }

  return `0x${BigInt(value).toString(16)}`;
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

async function castSend(args: string[]) {
  const { stdout, stderr } = await execFileAsync("cast", [
    "send",
    "--rpc-url",
    rpcUrl(),
    "--private-key",
    env("MARKET_ACTOR_PRIVATE_KEY"),
    ...args
  ]);

  if (stderr.trim()) {
    console.error(stderr.trim());
  }

  if (stdout.trim()) {
    console.log(stdout.trim());
  }
}

async function main() {
  loadRepoEnv();

  const actor = envAddress("MARKET_ACTOR_ADDRESS");
  const tokenIn = envAddress("MARKET_MOVE_TOKEN_IN", env("DEMO_TOKEN_OUT", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"));
  const tokenOut = envAddress("MARKET_MOVE_TOKEN_OUT", env("DEMO_TOKEN_IN", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"));
  const amountIn = env("MARKET_MOVE_AMOUNT_IN", "100000000000000000000");
  const permit2 = envAddress("UNISWAP_PERMIT2_ADDRESS", permit2Address);
  const universalRouter = envAddress("UNISWAP_UNIVERSAL_ROUTER_ADDRESS", universalRouterAddress);

  await rpc<unknown>("tenderly_setBalance", [actor, amountToHex(env("MARKET_ACTOR_ETH_BALANCE", "10000000000000000000"))]);
  await rpc<unknown>("tenderly_setErc20Balance", [
    tokenIn,
    actor,
    amountToHex(env("MARKET_ACTOR_TOKEN_BALANCE", "1000000000000000000000"))
  ]);

  await castSend([tokenIn, "approve(address,uint256)", permit2, maxUint256.toString()]);
  await castSend([permit2, "approve(address,address,uint160,uint48)", tokenIn, universalRouter, maxUint160.toString(), maxUint48.toString()]);

  const quote = await getUniswapQuote({
    chainId: 1,
    tokenIn,
    tokenOut,
    amountIn,
    maxSlippageBps: Number(env("MARKET_MOVE_SLIPPAGE_BPS", "100")),
    swapper: actor
  });
  const swap = await createUniswapSwapTransaction(quote, {
    deadline: Math.floor(Date.now() / 1000) + 30 * 60
  });

  await castSend([
    "--gas-limit",
    env("MARKET_MOVE_GAS_LIMIT", "3000000"),
    "--value",
    swap.value,
    swap.to,
    swap.data
  ]);

  console.log(JSON.stringify({
    actor,
    tokenIn,
    tokenOut,
    amountIn,
    quotedAmountOut: quote.amountOut
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
