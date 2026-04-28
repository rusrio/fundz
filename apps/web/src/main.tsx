import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, ArrowRightLeft, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import type { Agent, Execution, StoredIntent } from "@fundz/shared";
import "./styles.css";

type DashboardSnapshot = {
  agents: Agent[];
  intents: StoredIntent[];
  executions: Execution[];
  metrics: {
    agentCount: number;
    intentCount: number;
    executionCount: number;
  };
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const emptySnapshot: DashboardSnapshot = {
  agents: [],
  intents: [],
  executions: [],
  metrics: {
    agentCount: 0,
    intentCount: 0,
    executionCount: 0
  }
};

function shortAddress(value: string | null): string {
  if (!value) {
    return "Not linked";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusClass(status: string): string {
  if (status.includes("approved") || status === "confirmed") {
    return "status statusPositive";
  }

  if (status.includes("rejected") || status === "failed") {
    return "status statusNegative";
  }

  return "status";
}

function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/dashboard`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      setSnapshot((await response.json()) as DashboardSnapshot);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load dashboard";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const approvedIntentCount = useMemo(() => {
    return snapshot.intents.filter((intent) => intent.status === "policy_approved").length;
  }, [snapshot.intents]);

  const rejectedIntentCount = useMemo(() => {
    return snapshot.intents.filter((intent) => intent.status === "policy_rejected").length;
  }, [snapshot.intents]);

  const latestExecution = snapshot.executions[0];

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fundz control plane</p>
          <h1>Agent execution dashboard</h1>
        </div>
        <button className="refreshButton" type="button" onClick={() => void loadDashboard()} disabled={isLoading}>
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {error ? <div className="errorBanner">API unavailable: {error}</div> : null}

      <section className="metricsGrid" aria-label="Dashboard metrics">
        <Metric icon={<WalletCards size={18} />} label="Agents" value={snapshot.metrics.agentCount} />
        <Metric icon={<ShieldCheck size={18} />} label="Approved intents" value={approvedIntentCount} />
        <Metric icon={<Activity size={18} />} label="Rejected intents" value={rejectedIntentCount} />
        <Metric icon={<ArrowRightLeft size={18} />} label="Executions" value={snapshot.metrics.executionCount} />
      </section>

      <section className="workspace">
        <div className="primaryColumn">
          <TableHeader title="Agents" count={snapshot.agents.length} />
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Safe</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.agents.map((agent) => (
                  <tr key={agent.id}>
                    <td>
                      <strong>{agent.name}</strong>
                      <span>{agent.id}</span>
                    </td>
                    <td>{shortAddress(agent.ownerAddress)}</td>
                    <td>{shortAddress(agent.safeAddress)}</td>
                    <td>
                      <span className={statusClass(agent.status)}>{agent.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TableHeader title="Intents" count={snapshot.intents.length} />
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Nonce</th>
                  <th>Route</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.intents.map((intent) => (
                  <tr key={intent.id}>
                    <td>
                      <strong>{intent.nonce}</strong>
                      <span>{intent.rejectionReason ?? "No rejection reason"}</span>
                    </td>
                    <td>
                      {shortAddress(intent.tokenIn)} to {shortAddress(intent.tokenOut)}
                    </td>
                    <td>{intent.amountIn}</td>
                    <td>
                      <span className={statusClass(intent.status)}>{intent.status}</span>
                    </td>
                    <td>{formatDate(intent.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="sidePanel">
          <TableHeader title="Executions" count={snapshot.executions.length} />
          {latestExecution ? (
            <div className="executionFocus">
              <span className={statusClass(latestExecution.status)}>{latestExecution.status}</span>
              <h2>{shortAddress(latestExecution.safeAddress)}</h2>
              <dl>
                <div>
                  <dt>Adapter</dt>
                  <dd>{latestExecution.adapter}</dd>
                </div>
                <div>
                  <dt>Amount in</dt>
                  <dd>{latestExecution.amountIn}</dd>
                </div>
                <div>
                  <dt>Amount out</dt>
                  <dd>{latestExecution.amountOut ?? "Pending"}</dd>
                </div>
                <div>
                  <dt>Tx hash</dt>
                  <dd>{latestExecution.txHash ? shortAddress(latestExecution.txHash) : "Not submitted"}</dd>
                </div>
              </dl>
              <p>{latestExecution.errorMessage ?? "Execution ready."}</p>
            </div>
          ) : (
            <div className="emptyState">No executions yet.</div>
          )}

          <div className="executionList">
            {snapshot.executions.slice(0, 8).map((execution) => (
              <div className="executionRow" key={execution.id}>
                <div>
                  <strong>{execution.adapter}</strong>
                  <span>{formatDate(execution.createdAt)}</span>
                </div>
                <span className={statusClass(execution.status)}>{execution.status}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TableHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="tableHeader">
      <h2>{title}</h2>
      <span>{count}</span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
