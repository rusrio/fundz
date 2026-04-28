import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./client.js";

function loadRepoEnv() {
  const repoEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../..", ".env");

  if (!existsSync(repoEnvPath)) {
    return;
  }

  for (const line of readFileSync(repoEnvPath, "utf8").split(/\r?\n/)) {
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

loadRepoEnv();

function envValue(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

const demoOwnerAddress = envValue("DEMO_OWNER_ADDRESS", "0x1111111111111111111111111111111111111111");
const demoSafeAddress = envValue("DEMO_SAFE_ADDRESS", "0x2222222222222222222222222222222222222222");
const demoAllowedTokens = [
  envValue("DEMO_TOKEN_IN", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  envValue("DEMO_TOKEN_OUT", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
];

const demoPolicy = {
  chainId: 1,
  allowedTokenAddresses: JSON.stringify(demoAllowedTokens),
  maxAmountPerOperation: envValue("DEMO_MAX_AMOUNT_PER_OPERATION", "1000000000"),
  cooldownSeconds: 60,
  dailyLimit: envValue("DEMO_DAILY_LIMIT", "5000000000")
};

async function main() {
  const agent = await prisma.agent.upsert({
    where: { ownerAddress: demoOwnerAddress },
    update: {
      name: "Demo Agent",
      safeAddress: demoSafeAddress,
      status: "ACTIVE"
    },
    create: {
      name: "Demo Agent",
      ownerAddress: demoOwnerAddress,
      safeAddress: demoSafeAddress,
      status: "ACTIVE"
    }
  });

  await prisma.policy.upsert({
    where: { agentId: agent.id },
    update: demoPolicy,
    create: {
      agentId: agent.id,
      ...demoPolicy
    }
  });

  console.log(`Seeded demo agent ${agent.id}`);
  console.log(`Owner address: ${demoOwnerAddress}`);
  console.log(`Safe address: ${demoSafeAddress}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
