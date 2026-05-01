import type { Agent, Execution, StoredIntent } from "@fundz/shared";

export type DashboardSnapshot = {
  agents: Agent[];
  intents: StoredIntent[];
  executions: Execution[];
  riskStates: RiskDashboardState[];
  portfolioStates: PortfolioDashboardState[];
  metrics: {
    agentCount: number;
    intentCount: number;
    executionCount: number;
  };
};

export type PortfolioDashboardState = {
  agentId: string;
  safeAddress: string | null;
  baseAsset: string;
  totalValue: string;
  pnl: string;
  pnlBps: number;
  drawdown: string;
  positions: PortfolioPosition[];
  error: string | null;
};

export type PortfolioPosition = {
  symbol: string;
  address: string;
  decimals: number;
  balance: string;
  valueInBase: string;
};

export type RiskDashboardState = {
  agentId: string;
  agentName: string;
  safeAddress: string | null;
  enabled: boolean;
  baseAsset: string;
  riskAsset: string;
  protocolCapital: string;
  agentLossMargin: string;
  accessFee: string;
  protectedValue: string;
  totalValue: string;
  lossBufferRemaining: string;
  breached: boolean;
  latestSnapshot: {
    id: string;
    totalValue: string;
    breached: boolean;
    createdAt: string;
  } | null;
  latestEvent: {
    id: string;
    status: string;
    reason: string;
    emergencyTxHash: string | null;
    errorMessage: string | null;
    createdAt: string;
  } | null;
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
