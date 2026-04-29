import type { Agent, Execution, StoredIntent } from "@fundz/shared";

export type DashboardSnapshot = {
  agents: Agent[];
  intents: StoredIntent[];
  executions: Execution[];
  metrics: {
    agentCount: number;
    intentCount: number;
    executionCount: number;
  };
};

export type EthereumProvider = {
  request(args: { method: "eth_requestAccounts" }): Promise<string[]>;
};

export type WalletState = {
  status: "idle" | "missing" | "connecting" | "connected" | "error";
  account: string | null;
  error: string | null;
};

export type AgentPerformance = {
  totalIntents: number;
  approvalRate: number;
  rejectedCount: number;
  executionsSubmitted: number;
  executionsPending: number;
  executionsFailed: number;
  totalAmountIn: string;
  latestExecutionStatus: string;
  lastActivity: string;
};

export type FundingChallenge = {
  name: string;
  phase: string;
  allocation: string;
  profitTarget: string;
  maxDrawdown: string;
  dailyDrawdown: string;
  timeLimit: string;
  action: string;
  featured?: boolean;
};

export type ReadinessItem = {
  label: string;
  complete: boolean;
};
