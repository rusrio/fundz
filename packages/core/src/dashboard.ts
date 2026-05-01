import { listAgents } from "./agents.js";
import { listExecutions } from "./execution.js";
import { listIntents } from "./intents.js";
import { listPortfolioDashboardStates } from "./portfolio.js";
import { listRiskDashboardStates } from "./risk.js";

export async function getDashboardSnapshot() {
  const [agents, intents, executions, riskStates, portfolioStates] = await Promise.all([
    listAgents(),
    listIntents(),
    listExecutions(),
    listRiskDashboardStates(),
    listPortfolioDashboardStates()
  ]);

  return {
    agents,
    intents,
    riskStates,
    portfolioStates,
    metrics: {
      agentCount: agents.length,
      intentCount: intents.length,
      executionCount: executions.length
    },
    executions
  };
}
