import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import type { Agent, Execution, Policy, RegisterAgentResponse, StoredIntent } from "@fundz/shared";
import { Dashboard } from "./components/Dashboard.js";
import { Landing } from "./components/Landing.js";
import { apiRequest } from "./lib/api.js";
import type { DashboardSnapshot, EthereumProvider, WalletState } from "./types.js";
import "./styles.css";

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const emptySnapshot: DashboardSnapshot = {
  agents: [],
  intents: [],
  executions: [],
  riskStates: [],
  portfolioStates: [],
  metrics: {
    agentCount: 0,
    intentCount: 0,
    executionCount: 0
  }
};

const dashboardRefreshMs = 5_000;

function App() {
  const [view, setView] = useState<"landing" | "app">(() =>
    window.location.pathname.includes("dashboard") ? "app" : "landing"
  );
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [wallet, setWallet] = useState<WalletState>({ status: "idle", account: null, error: null });
  const [agent, setAgent] = useState<Agent | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [agentCredentialToken, setAgentCredentialToken] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("Demo execution agent");
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [lastDashboardUpdatedAt, setLastDashboardUpdatedAt] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [payoutResult, setPayoutResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dashboardRequestInFlight = useRef(false);

  function injectedProvider(): EthereumProvider | null {
    const provider = window.ethereum;

    if (!provider) {
      return null;
    }

    return provider.providers?.find((candidate) => candidate.isMetaMask)
      ?? provider.providers?.find((candidate) => candidate.isRabby)
      ?? provider;
  }

  function firstAccount(result: unknown): string | null {
    if (!Array.isArray(result)) {
      return null;
    }

    const account = result.find((item): item is string => typeof item === "string" && /^0x[a-fA-F0-9]{40}$/.test(item));
    return account ?? null;
  }

  const loadDashboard = useCallback(async (options: { silent?: boolean } = {}) => {
    if (dashboardRequestInFlight.current) {
      return;
    }

    dashboardRequestInFlight.current = true;

    if (!options.silent) {
      setIsLoadingDashboard(true);
    }

    setError(null);

    try {
      setSnapshot(await apiRequest<DashboardSnapshot>("/dashboard"));
      setLastDashboardUpdatedAt(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
    } finally {
      dashboardRequestInFlight.current = false;

      if (!options.silent) {
        setIsLoadingDashboard(false);
      }
    }
  }, []);

  async function loadPolicy(agentId: string) {
    try {
      const response = await apiRequest<{ policy: Policy }>(`/agents/${agentId}/policy`);
      setPolicy(response.policy);
    } catch {
      setPolicy(null);
    }
  }

  async function authenticate(ownerAddress: string) {
    const response = await apiRequest<{ agent: Agent | null }>("/agents/authenticate", {
      method: "POST",
      body: JSON.stringify({ ownerAddress })
    });

    setAgent(response.agent);

    if (response.agent) {
      setAgentName(response.agent.name);
      await loadPolicy(response.agent.id);
    } else {
      setPolicy(null);
    }
  }

  async function connectWallet() {
    setWallet({ status: "connecting", account: null, error: null });
    setError(null);

    const provider = injectedProvider();

    if (!provider) {
      setAgent(null);
      setPolicy(null);
      setWallet({ status: "missing", account: null, error: "Install MetaMask, Rabby, or another EIP-1193 wallet." });
      return;
    }

    try {
      const account = firstAccount(await provider.request({ method: "eth_requestAccounts" }))
        ?? firstAccount(await provider.request({ method: "eth_accounts" }));

      if (!account) {
        throw new Error("Wallet did not return an account");
      }

      setWallet({ status: "connected", account, error: null });
      setView("app");

      try {
        await authenticate(account);
      } catch (authError) {
        setAgent(null);
        setPolicy(null);
        setError(authError instanceof Error ? authError.message : "Unable to load agent for connected wallet");
      }
    } catch (connectError) {
      setAgent(null);
      setPolicy(null);
      setWallet({
        status: "error",
        account: null,
        error: connectError instanceof Error ? connectError.message : "Wallet connection failed"
      });
    }
  }

  function disconnectWallet() {
    setWallet({ status: "idle", account: null, error: null });
    setAgent(null);
    setPolicy(null);
    setAgentCredentialToken(null);
    setPayoutResult(null);
    setError(null);
  }

  async function registerConnectedAgent(event: FormEvent) {
    event.preventDefault();

    if (!wallet.account) {
      setError("Connect a wallet before registering an agent.");
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      const result = await apiRequest<RegisterAgentResponse>("/agents/register", {
        method: "POST",
        body: JSON.stringify({
          name: agentName,
          ownerAddress: wallet.account
        })
      });

      setAgent(result.agent);
      setPolicy(result.policy);
      setAgentCredentialToken(result.credential.token);
      await loadDashboard();
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Unable to register agent");
    } finally {
      setIsRegistering(false);
    }
  }

  async function requestPayout() {
    if (!selectedAgent || !wallet.account) {
      setError("Connect the wallet that owns the agent before requesting payout.");
      return;
    }

    setIsRequestingPayout(true);
    setPayoutResult(null);
    setError(null);

    try {
      const result = await apiRequest<{
        payout: {
          amount: string;
          status: string;
          txHash: string | null;
          errorMessage: string | null;
        };
      }>(`/agents/${selectedAgent.id}/payouts`, {
        method: "POST",
        body: JSON.stringify({ ownerAddress: wallet.account })
      });

      if (result.payout.status === "FAILED") {
        throw new Error(result.payout.errorMessage ?? "Payout failed");
      }

      setPayoutResult(`Payout submitted: ${result.payout.txHash ?? "pending"}`);
      await loadDashboard();
    } catch (payoutError) {
      setError(payoutError instanceof Error ? payoutError.message : "Unable to request payout");
    } finally {
      setIsRequestingPayout(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (view !== "app") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadDashboard({ silent: true });
      }
    }, dashboardRefreshMs);

    return () => window.clearInterval(intervalId);
  }, [loadDashboard, view]);

  const selectedAgent = useMemo(() => {
    if (agent) {
      return agent;
    }

    if (wallet.account) {
      return snapshot.agents.find((candidate: Agent) => candidate.ownerAddress.toLowerCase() === wallet.account?.toLowerCase()) ?? null;
    }

    return null;
  }, [agent, snapshot.agents, wallet.account]);

  const agentIntents = selectedAgent ? snapshot.intents.filter((intent: StoredIntent) => intent.agentId === selectedAgent.id) : [];
  const agentExecutions = selectedAgent ? snapshot.executions.filter((execution: Execution) => execution.agentId === selectedAgent.id) : [];
  const latestExecution = agentExecutions[0];
  const selectedRiskState = selectedAgent
    ? snapshot.riskStates.find((riskState) => riskState.agentId === selectedAgent.id) ?? null
    : null;
  const selectedPortfolioState = selectedAgent
    ? snapshot.portfolioStates.find((portfolioState) => portfolioState.agentId === selectedAgent.id) ?? null
    : null;

  if (view === "landing") {
    return <Landing onLaunch={() => setView("app")} onConnect={() => void connectWallet()} wallet={wallet} />;
  }

  return (
    <Dashboard
      wallet={wallet}
      agent={agent}
      policy={policy}
      selectedAgent={selectedAgent}
      agentIntents={agentIntents}
      agentExecutions={agentExecutions}
      latestExecution={latestExecution}
      selectedRiskState={selectedRiskState}
      selectedPortfolioState={selectedPortfolioState}
      agentCredentialToken={agentCredentialToken}
      agentName={agentName}
      isLoadingDashboard={isLoadingDashboard}
      lastDashboardUpdatedAt={lastDashboardUpdatedAt}
      dashboardRefreshMs={dashboardRefreshMs}
      isRegistering={isRegistering}
      isRequestingPayout={isRequestingPayout}
      payoutResult={payoutResult}
      error={error}
      setView={setView}
      setAgentName={setAgentName}
      loadDashboard={() => void loadDashboard()}
      connectWallet={() => void connectWallet()}
      disconnectWallet={disconnectWallet}
      registerConnectedAgent={(event: FormEvent) => void registerConnectedAgent(event)}
      requestPayout={() => void requestPayout()}
    />
  );
}

createRoot(document.getElementById("root")!).render(<App />);
