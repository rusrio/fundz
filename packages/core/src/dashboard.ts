import { listAgents } from "./agents.js";
import { listExecutions } from "./execution.js";
import { listIntents } from "./intents.js";

export async function getDashboardSnapshot() {
  const [agents, intents, executions] = await Promise.all([
    listAgents(),
    listIntents(),
    listExecutions()
  ]);

  return {
    agents,
    intents,
    metrics: {
      agentCount: agents.length,
      intentCount: intents.length,
      executionCount: executions.length
    },
    executions
  };
}
