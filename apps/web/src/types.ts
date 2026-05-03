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
  pnlHistory: PnlHistoryPoint[];
  positions: PortfolioPosition[];
  error: string | null;
};

export type PnlHistoryPoint = {
  createdAt: string;
  totalValue: string;
  pnl: string;
  pnlBps: number;
  breached: boolean;
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
  initialValue: string;
  totalValue: string;
  lossBufferRemaining: string;
  claimablePayout: string;
  claimedPayout: string;
  totalPayoutReceived: string;
  payoutShareBps: number;
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
  isMetaMask?: boolean;
  isRabby?: boolean;
  providers?: EthereumProvider[];
  request(args: { method: "eth_accounts" | "eth_requestAccounts" }): Promise<unknown>;
};

export type WalletState = {
  status: "idle" | "missing" | "connecting" | "connected" | "error";
  account: string | null;
  error: string | null;
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
