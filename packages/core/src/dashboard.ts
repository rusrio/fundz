import { prisma } from "@fundz/db";
import { listAgents } from "./agents.js";
import { listIntents } from "./intents.js";

export async function getDashboardSnapshot() {
  const [agents, intents, executions] = await Promise.all([
    listAgents(),
    listIntents(),
    prisma.execution.count()
  ]);

  return {
    agents,
    intents,
    metrics: {
      agentCount: agents.length,
      intentCount: intents.length,
      executionCount: executions
    }
  };
}
