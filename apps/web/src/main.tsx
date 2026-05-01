import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import type { Agent, Execution, Policy, RegisterAgentResponse, StoredIntent } from "@fundz/shared";
import { Dashboard } from "./components/Dashboard.js";
import { Landing } from "./components/Landing.js";
import { apiRequest } from "./lib/api.js";
import { computePerformance } from "./lib/format.js";
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

function App() {
  const [view, setView] = useState<"landing" | "app">(() =>
    window.location.pathname.includes("dashboard") ? "app" : "landing"
  );
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [wallet, setWallet] = useState<WalletState>({ status: "idle", account: null, error: null });
  const [agent, setAgent] = useState<Agent | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [agentName, setAgentName] = useState("Demo execution agent");
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setIsLoadingDashboard(true);
    setError(null);

    try {
      setSnapshot(await apiRequest<DashboardSnapshot>("/dashboard"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
    } finally {
      setIsLoadingDashboard(false);
    }
  }

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

    if (!window.ethereum) {
      setAgent(null);
      setPolicy(null);
      setWallet({ status: "missing", account: null, error: "Install MetaMask, Rabby, or another EIP-1193 wallet." });
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const account = accounts[0] ?? null;

      if (!account) {
        throw new Error("Wallet did not return an account");
      }

      setWallet({ status: "connected", account, error: null });
      await authenticate(account);
      setView("app");
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
      await loadDashboard();
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Unable to register agent");
    } finally {
      setIsRegistering(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const selectedAgent = useMemo(() => {
    if (agent) {
      return agent;
    }

    if (wallet.account) {
      return snapshot.agents.find((candidate: Agent) => candidate.ownerAddress.toLowerCase() === wallet.account?.toLowerCase()) ?? null;
    }

    return null;
  }, [agent, snapshot.agents, wallet.account]);

  const performance = useMemo(() => computePerformance(selectedAgent, snapshot), [selectedAgent, snapshot]);
  const agentIntents = selectedAgent ? snapshot.intents.filter((intent: StoredIntent) => intent.agentId === selectedAgent.id) : [];
  const agentExecutions = selectedAgent ? snapshot.executions.filter((execution: Execution) => execution.agentId === selectedAgent.id) : [];
  const latestExecution = agentExecutions[0];
  const selectedRiskState = selectedAgent
    ? snapshot.riskStates.find((riskState) => riskState.agentId === selectedAgent.id) ?? null
    : null;
  const selectedPortfolioState = selectedAgent
    ? snapshot.portfolioStates.find((portfolioState) => portfolioState.agentId === selectedAgent.id) ?? null
    : null;
  const checklist = [
    { label: "Wallet connected", complete: wallet.status === "connected" },
    { label: "Agent registered", complete: Boolean(agent) },
    { label: "Fundz funded Safe assigned", complete: Boolean(agent?.safeAddress) },
    { label: "Policy active", complete: Boolean(policy) },
    { label: "Signed intent respects allowlist, amount, cooldown, and daily limit", complete: Boolean(policy) }
  ];
  const readyForCapitalAccess = checklist.every((item) => item.complete);

  if (view === "landing") {
    return <Landing onLaunch={() => setView("app")} onConnect={() => void connectWallet()} wallet={wallet} />;
  }

  return (
    <Dashboard
      snapshot={snapshot}
      wallet={wallet}
      agent={agent}
      policy={policy}
      selectedAgent={selectedAgent}
      performance={performance}
      agentIntents={agentIntents}
      agentExecutions={agentExecutions}
      latestExecution={latestExecution}
      selectedRiskState={selectedRiskState}
      selectedPortfolioState={selectedPortfolioState}
      checklist={checklist}
      readyForCapitalAccess={readyForCapitalAccess}
      agentName={agentName}
      isLoadingDashboard={isLoadingDashboard}
      isRegistering={isRegistering}
      error={error}
      setView={setView}
      setAgentName={setAgentName}
      loadDashboard={() => void loadDashboard()}
      connectWallet={() => void connectWallet()}
      registerConnectedAgent={(event: FormEvent) => void registerConnectedAgent(event)}
    />
  );
}

createRoot(document.getElementById("root")!).render(<App />);
