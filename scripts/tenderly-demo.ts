import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeSafeTransaction } from "../packages/safe-kit/src/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const universalRouterAddress = "0x66a9893cc07d91d95644aedd05d03f95e1dba8af";
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
  const currentValue = process.env[name];
  const value = currentValue && currentValue.length > 0 ? currentValue : fallback;

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

function amountToHex(value: string): `0x${string}` {
  if (/^0x[a-fA-F0-9]+$/.test(value)) {
    return value as `0x${string}`;
  }

  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`Amount must be a decimal integer or hex value: ${value}`);
  }

  return `0x${BigInt(value).toString(16)}`;
}

function encodeWord(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

function encodeAddress(address: string): string {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function erc20ApproveData(spender: string, amount: bigint): `0x${string}` {
  return `0x095ea7b3${encodeAddress(spender)}${encodeWord(amount)}`;
}

function permit2ApproveData(token: string, spender: string, amount: bigint, expiration: bigint): `0x${string}` {
  return `0x87517c45${encodeAddress(token)}${encodeAddress(spender)}${encodeWord(amount)}${encodeWord(expiration)}`;
}

async function rpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    })
  });

  const body = (await response.json()) as { result?: T; error?: { message?: string } };

  if (!response.ok || body.error) {
    throw new Error(`${method} failed: ${body.error?.message ?? response.statusText}`);
  }

  return body.result as T;
}

function balanceOfData(address: string): `0x${string}` {
  return `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}`;
}

function printBalance(label: string, value: string) {
  console.log(`${label}: ${BigInt(value).toString()} (${value})`);
}

function rpcUrl(): string {
  return env("TENDERLY_VNET_RPC_URL", process.env.SAFE_RPC_URL);
}

async function prepareTenderly() {
  const url = rpcUrl();
  const executorAddress = envAddress("SAFE_EXECUTOR_ADDRESS");
  const safeAddress = envAddress("DEMO_SAFE_ADDRESS", "0x2222222222222222222222222222222222222222");
  const tokenIn = envAddress("DEMO_TOKEN_IN", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  const executorEthBalance = amountToHex(env("DEMO_EXECUTOR_ETH_BALANCE", "10000000000000000000"));
  const safeTokenBalance = amountToHex(env("DEMO_SAFE_TOKEN_BALANCE", "100000000000"));

  await rpc<unknown>(url, "tenderly_setBalance", [executorAddress, executorEthBalance]);
  console.log(`Set executor ETH balance for ${executorAddress}`);

  await rpc<unknown>(url, "tenderly_setErc20Balance", [tokenIn, safeAddress, safeTokenBalance]);
  console.log(`Set Safe token balance for ${safeAddress}`);
}

async function approveTenderly() {
  const safeAddress = envAddress("DEMO_SAFE_ADDRESS", "0x2222222222222222222222222222222222222222");
  const tokenIn = envAddress("DEMO_TOKEN_IN", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  const tokenOut = envAddress("DEMO_TOKEN_OUT", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  const permit2 = envAddress("UNISWAP_PERMIT2_ADDRESS", permit2Address);
  const universalRouter = envAddress("UNISWAP_UNIVERSAL_ROUTER_ADDRESS", universalRouterAddress);
  const tokens = [...new Set([tokenIn, tokenOut])];

  for (const token of tokens) {
    const erc20Approval = await executeSafeTransaction({
      safeAddress,
      to: token,
      data: erc20ApproveData(permit2, maxUint256)
    });

    console.log(`Approved Permit2 for token ${token}: ${erc20Approval.txHash}`);

    const permit2Approval = await executeSafeTransaction({
      safeAddress,
      to: permit2,
      data: permit2ApproveData(token, universalRouter, maxUint160, maxUint48)
    });

    console.log(`Approved Universal Router in Permit2 for token ${token}: ${permit2Approval.txHash}`);
  }
}

async function showBalances() {
  const url = rpcUrl();
  const executorAddress = envAddress("SAFE_EXECUTOR_ADDRESS");
  const safeAddress = envAddress("DEMO_SAFE_ADDRESS", "0x2222222222222222222222222222222222222222");
  const tokenIn = envAddress("DEMO_TOKEN_IN", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  const tokenOut = envAddress("DEMO_TOKEN_OUT", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");

  const executorEth = await rpc<string>(url, "eth_getBalance", [executorAddress, "latest"]);
  const safeToken = await rpc<string>(url, "eth_call", [
    {
      to: tokenIn,
      data: balanceOfData(safeAddress)
    },
    "latest"
  ]);
  const safeRiskToken = await rpc<string>(url, "eth_call", [
    {
      to: tokenOut,
      data: balanceOfData(safeAddress)
    },
    "latest"
  ]);

  printBalance("Executor ETH wei", executorEth);
  printBalance("Safe base token units", safeToken);
  printBalance("Safe risk token units", safeRiskToken);
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json()) as T | { error?: string };

  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${"error" in payload ? payload.error : response.statusText}`);
  }

  return payload as T;
}

async function submitSwap() {
  const apiUrl = env("FUNDZ_API_URL", process.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
  const existingToken = process.env.FUNDZ_AGENT_TOKEN;
  const ownerAddress = envAddress("DEMO_OWNER_ADDRESS", "0x1111111111111111111111111111111111111111");
  const safeAddress = envAddress("DEMO_SAFE_ADDRESS", "0x2222222222222222222222222222222222222222");
  const tokenIn = envAddress("DEMO_TOKEN_IN", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  const tokenOut = envAddress("DEMO_TOKEN_OUT", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  const amountIn = env("DEMO_AMOUNT_IN", "1000000");
  const maxSlippageBps = Number(env("DEMO_MAX_SLIPPAGE_BPS", "50"));

  const registration = await postJson<{ agent: { id: string }; credential?: { token: string } }>(`${apiUrl}/agents/register`, {
    name: "Tenderly Demo Agent",
    ownerAddress,
    safeAddress
  });
  const agentToken = existingToken && existingToken.length > 0 ? existingToken : registration.credential?.token;

  if (!agentToken) {
    throw new Error("FUNDZ_AGENT_TOKEN is required when registration does not return a credential");
  }

  const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const intent = await postJson<unknown>(`${apiUrl}/intents`, {
    agentId: registration.agent.id,
    nonce: `tenderly-${Date.now()}`,
    action: "uniswap.swap",
    chainId: 1,
    tokenIn,
    tokenOut,
    amountIn,
    maxSlippageBps,
    deadline
  }, agentToken);

  console.log(JSON.stringify(intent, null, 2));
}

async function main() {
  loadRepoEnv();

  const command = process.argv[2];

  if (command === "prepare") {
    await prepareTenderly();
    return;
  }

  if (command === "balances") {
    await showBalances();
    return;
  }

  if (command === "approve") {
    await approveTenderly();
    return;
  }

  if (command === "swap") {
    await submitSwap();
    return;
  }

  throw new Error("Usage: tenderly-demo.ts <prepare|balances|approve|swap>");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
