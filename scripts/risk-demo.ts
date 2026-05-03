import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../packages/db/src/client.js";
import { monitorAllRiskPoliciesOnce, monitorRiskOnce, upsertRiskPolicy } from "../packages/core/src/risk.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function addAmounts(...amounts: string[]): string {
  return amounts.reduce((sum, amount) => sum + BigInt(amount), 0n).toString();
}

async function demoAgent() {
  const ownerAddress = env("DEMO_OWNER_ADDRESS");
  const agents = await prisma.agent.findMany({
    where: {
      ownerAddress: {
        in: [ownerAddress, ownerAddress.toLowerCase()]
      }
    },
    orderBy: { createdAt: "desc" }
  });
  const agent = agents.find((candidate) => candidate.ownerAddress.toLowerCase() === ownerAddress.toLowerCase());

  if (!agent) {
    throw new Error(`Demo agent not found for owner ${ownerAddress}`);
  }

  return agent;
}

async function setupRiskPolicy() {
  const agent = await demoAgent();
  const protocolCapital = env("FUNDZ_PROTOCOL_CAPITAL", "89000000000");
  const agentLossMargin = env("AGENT_LOSS_MARGIN", "10000000000");
  const accessFee = env("AGENT_ACCESS_FEE", "1000000000");
  const initialValue = addAmounts(protocolCapital, agentLossMargin, accessFee);
  const protectedValue = addAmounts(protocolCapital, accessFee);
  const riskPolicy = await upsertRiskPolicy({
    agentId: agent.id,
    chainId: 1,
    baseAsset: env("DEMO_TOKEN_IN", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    riskAsset: env("DEMO_TOKEN_OUT", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
    protocolCapital,
    agentLossMargin,
    accessFee,
    initialValue: env("RISK_INITIAL_VALUE", env("DEMO_SAFE_TOKEN_BALANCE", initialValue)),
    maxLoss: env("RISK_MAX_LOSS", agentLossMargin),
    minValue: env("RISK_MIN_VALUE", protectedValue),
    emergencySlippageBps: Number(env("RISK_EMERGENCY_SLIPPAGE_BPS", "100")),
    pollSeconds: Math.max(1, Math.floor(Number(env("RISK_MONITOR_INTERVAL_MS", "10000")) / 1000))
  });

  console.log(JSON.stringify({ riskPolicy }, null, 2));
}

async function monitorRisk() {
  const intervalMs = Number(env("RISK_MONITOR_INTERVAL_MS", "10000"));
  const once = process.env.RISK_MONITOR_ONCE === "true";

  do {
    const result = process.env.RISK_MONITOR_AGENT_ID
      ? await monitorRiskOnce(process.env.RISK_MONITOR_AGENT_ID)
      : await monitorAllRiskPoliciesOnce();
    console.log(JSON.stringify(result, null, 2));

    const hasEvent = Array.isArray(result)
      ? result.some((item) => item.event)
      : Boolean(result.event);

    if (hasEvent || once) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (true);
}

async function main() {
  loadRepoEnv();

  const command = process.argv[2];

  if (command === "setup") {
    await setupRiskPolicy();
    return;
  }

  if (command === "monitor") {
    await monitorRisk();
    return;
  }

  throw new Error("Usage: risk-demo.ts <setup|monitor>");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
