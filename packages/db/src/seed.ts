import { prisma } from "./client.js";

const demoOwnerAddress = "0x1111111111111111111111111111111111111111";
const demoSafeAddress = "0x2222222222222222222222222222222222222222";
const demoAllowedTokens = [
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
];

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
    update: {
      chainId: 1,
      allowedTokenAddresses: JSON.stringify(demoAllowedTokens),
      maxAmountPerOperation: "1000000000",
      cooldownSeconds: 60,
      dailyLimit: "5000000000"
    },
    create: {
      agentId: agent.id,
      chainId: 1,
      allowedTokenAddresses: JSON.stringify(demoAllowedTokens),
      maxAmountPerOperation: "1000000000",
      cooldownSeconds: 60,
      dailyLimit: "5000000000"
    }
  });

  console.log(`Seeded demo agent ${agent.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
