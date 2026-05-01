import { motion } from "framer-motion";
import type { FormEvent } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  CircleDot,
  Layers3,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  WalletCards
} from "lucide-react";
import type { Agent, Execution, Policy, StoredIntent } from "@fundz/shared";
import { formatSignedBps, shortAddress, statusClass } from "../lib/format.js";
import type { AgentPerformance, DashboardSnapshot, PortfolioDashboardState, ReadinessItem, RiskDashboardState, WalletState } from "../types.js";
import { AgentTable, BrandMark, IntentTable, Metric, SectionHeader, Stat } from "./ui.js";

type DashboardProps = {
  snapshot: DashboardSnapshot;
  wallet: WalletState;
  agent: Agent | null;
  policy: Policy | null;
  selectedAgent: Agent | null;
  performance: AgentPerformance;
  agentIntents: StoredIntent[];
  agentExecutions: Execution[];
  latestExecution: Execution | undefined;
  selectedRiskState: RiskDashboardState | null;
  selectedPortfolioState: PortfolioDashboardState | null;
  checklist: ReadinessItem[];
  readyForCapitalAccess: boolean;
  agentName: string;
  isLoadingDashboard: boolean;
  isRegistering: boolean;
  error: string | null;
  setView: (view: "landing" | "app") => void;
  setAgentName: (value: string) => void;
  loadDashboard: () => void;
  connectWallet: () => void;
  registerConnectedAgent: (event: FormEvent) => void;
};

export function Dashboard({
  snapshot,
  wallet,
  agent,
  policy,
  selectedAgent,
  performance,
  agentIntents,
  agentExecutions,
  latestExecution,
  selectedRiskState,
  selectedPortfolioState,
  checklist,
  readyForCapitalAccess,
  agentName,
  isLoadingDashboard,
  isRegistering,
  error,
  setView,
  setAgentName,
  loadDashboard,
  connectWallet,
  registerConnectedAgent
}: DashboardProps) {
  return (
    <main className="appShell">
      <header className="appTopbar">
        <BrandMark onClick={() => setView("landing")} />
        <div className="appActions">
          <button className="ghostButton" type="button" onClick={loadDashboard} disabled={isLoadingDashboard}>
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
          <button className="primaryButton compact" type="button" onClick={connectWallet} disabled={wallet.status === "connecting"}>
            <WalletCards size={16} aria-hidden="true" />
            {wallet.account ? shortAddress(wallet.account) : "Connect wallet"}
          </button>
        </div>
      </header>

      {error ? <div className="errorBanner">API unavailable: {error}</div> : null}
      {wallet.error ? <div className="warningBanner">{wallet.error}</div> : null}

      <motion.section
        className="workspaceHero"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div>
          <p className="eyebrow">Agent workspace</p>
          <h1>{selectedAgent?.name ?? "Register an agent to request capital"}</h1>
          <p>
            {selectedAgent
              ? `Owner ${shortAddress(selectedAgent.ownerAddress)} manages policy-scoped execution from ${shortAddress(selectedAgent.safeAddress)}.`
              : "Connect a wallet and register an agent. Fundz assigns the funded Safe before signed intents can reach execution."}
          </p>
        </div>
        <div className={readyForCapitalAccess ? "readiness ready" : "readiness"}>
          <CircleDot size={18} aria-hidden="true" />
          <span>{readyForCapitalAccess ? "Ready for capital access" : "Capital access locked"}</span>
        </div>
      </motion.section>

      <section className="appGrid">
        <div className="primaryColumn">
          <section className="workspacePanel">
            <SectionHeader eyebrow="Setup" title="Agent access path" meta={<span className={statusClass(agent?.status ?? "pending")}>{agent?.status ?? "pending"}</span>} />
            <div className="onboardingGrid">
              <div className="stepBlock">
                <div className="stepIcon">
                  <KeyRound size={18} aria-hidden="true" />
                </div>
                <h3>Connect wallet</h3>
                <p>The connected EIP-1193 account becomes the owner address for this demo.</p>
                <button className="secondaryButton" type="button" onClick={connectWallet} disabled={wallet.status === "connecting"}>
                  {wallet.status === "connecting" ? "Connecting..." : wallet.account ? shortAddress(wallet.account) : "Connect wallet"}
                </button>
              </div>

              <form className="stepBlock" onSubmit={registerConnectedAgent}>
                <div className="stepIcon">
                  <ShieldCheck size={18} aria-hidden="true" />
                </div>
                <h3>Register agent</h3>
                <label>
                  Agent name
                  <input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="Treasury rebalancer" />
                </label>
                <button className="secondaryButton" type="submit" disabled={isRegistering || !wallet.account || agentName.trim().length === 0}>
                  {agent ? "Update agent" : isRegistering ? "Registering..." : "Register agent"}
                </button>
              </form>

              <div className="stepBlock">
                <div className="stepIcon">
                  <LockKeyhole size={18} aria-hidden="true" />
                </div>
                <h3>Funded Safe</h3>
                <p>Fundz assigns the funded Safe automatically when the agent is registered.</p>
                <div className="assignedSafe">
                  <span>Assigned Safe</span>
                  <strong>{shortAddress(agent?.safeAddress ?? null)}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="workspacePanel">
            <SectionHeader eyebrow="Performance" title="Selected agent" meta={<span>{performance.lastActivity}</span>} />
            <div className="metricsGrid">
              <Metric icon={<WalletCards size={18} />} label="Portfolio value" value={selectedPortfolioState?.totalValue ?? "0"} tone="positive" />
              <Metric icon={<TrendingUp size={18} />} label="PnL" value={selectedPortfolioState ? `${selectedPortfolioState.pnl} (${formatSignedBps(selectedPortfolioState.pnlBps)})` : "0"} />
              <Metric icon={<ShieldCheck size={18} />} label="Margin left" value={selectedRiskState?.lossBufferRemaining ?? "0"} tone="positive" />
              <Metric icon={<ArrowRightLeft size={18} />} label="Trades" value={agentExecutions.length.toString()} />
            </div>
            <div className="executionStats">
              <Stat label="Drawdown" value={selectedPortfolioState?.drawdown ?? "0"} />
              <Stat label="Approval rate" value={`${performance.approvalRate}%`} />
              <Stat label="Failed" value={performance.executionsFailed} />
              <Stat label="Latest execution" value={performance.latestExecutionStatus} />
            </div>
          </section>

          <section className="workspacePanel">
            <SectionHeader eyebrow="Portfolio" title="Open positions" meta={<span>{selectedPortfolioState?.positions.length ?? 0}</span>} />
            {selectedPortfolioState?.error ? <div className="warningBanner inlineWarning">{selectedPortfolioState.error}</div> : null}
            {selectedPortfolioState ? (
              <div className="positionGrid">
                {selectedPortfolioState.positions.map((position) => (
                  <article className="positionTile" key={position.address}>
                    <div>
                      <span>{position.symbol}</span>
                      <strong>{position.balance}</strong>
                    </div>
                    <small>{shortAddress(position.address)}</small>
                    <dl>
                      <div>
                        <dt>USDC value</dt>
                        <dd>{position.valueInBase}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <div className="emptyState">No portfolio valuation yet.</div>
            )}
          </section>

          <section className="workspacePanel">
            <SectionHeader eyebrow="Demo flow" title="Live presentation track" meta={<span>{selectedAgent ? shortAddress(selectedAgent.ownerAddress) : "No agent"}</span>} />
            <div className="flowTrack">
              {[
                ["Wallet", wallet.status === "connected"],
                ["Agent", Boolean(agent)],
                ["Credential", Boolean(agent)],
                ["Safe", Boolean(agent?.safeAddress)],
                ["Policy", Boolean(policy)],
                ["Trades", agentExecutions.length > 0],
                ["Risk", Boolean(selectedRiskState)],
                ["Exit", Boolean(selectedRiskState?.latestEvent?.emergencyTxHash)]
              ].map(([label, complete]) => (
                <div className={complete ? "flowNode complete" : "flowNode"} key={String(label)}>
                  <span>{complete ? <CheckCircle2 size={15} aria-hidden="true" /> : <CircleDot size={15} aria-hidden="true" />}</span>
                  <strong>{label}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="workspacePanel">
            <SectionHeader eyebrow="Activity" title="Agent intents" meta={<span>{agentIntents.length}</span>} />
            {selectedAgent ? (
              <IntentTable intents={agentIntents} />
            ) : (
              <div className="emptyState">Connect the wallet that owns the agent to view its intents.</div>
            )}
          </section>
        </div>

        <aside className="sideRail">
          <section className="railPanel">
            <SectionHeader eyebrow="Capital access" title="Readiness" />
            <div className="agentIdentity">
              <Layers3 size={17} aria-hidden="true" />
              <div>
                <span>Agent public id</span>
                <strong>{selectedAgent ? shortAddress(selectedAgent.ownerAddress) : "Not registered"}</strong>
              </div>
            </div>
            <div className="checklist">
              {checklist.map((item) => (
                <div className={item.complete ? "checkItem complete" : "checkItem"} key={item.label}>
                  {item.complete ? <CheckCircle2 size={17} aria-hidden="true" /> : <CircleDot size={17} aria-hidden="true" />}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="railPanel">
            <SectionHeader eyebrow="Assigned policy" title={policy ? `Chain ${policy.chainId}` : "No policy yet"} />
            {policy ? (
              <dl className="policyList">
                <div>
                  <dt>Max operation</dt>
                  <dd>{policy.maxAmountPerOperation}</dd>
                </div>
                <div>
                  <dt>Daily limit</dt>
                  <dd>{policy.dailyLimit}</dd>
                </div>
                <div>
                  <dt>Cooldown</dt>
                  <dd>{policy.cooldownSeconds}s</dd>
                </div>
                <div>
                  <dt>Allowlist</dt>
                  <dd>{policy.allowedTokenAddresses.map(shortAddress).join(", ")}</dd>
                </div>
              </dl>
            ) : (
              <p className="mutedText">Register the connected wallet as an agent to create the default demo policy.</p>
            )}
          </section>

          <section className="railPanel">
            <SectionHeader
              eyebrow="Risk budget"
              title={selectedRiskState ? (selectedRiskState.breached ? "Emergency threshold hit" : "Protected capital") : "No risk policy"}
              meta={selectedRiskState ? <span className={selectedRiskState.breached ? statusClass("failed") : statusClass("active")}>{selectedRiskState.breached ? "breached" : "active"}</span> : undefined}
            />
            {selectedRiskState ? (
              <dl className="policyList">
                <div>
                  <dt>Fundz capital</dt>
                  <dd>{selectedRiskState.protocolCapital}</dd>
                </div>
                <div>
                  <dt>Agent margin</dt>
                  <dd>{selectedRiskState.agentLossMargin}</dd>
                </div>
                <div>
                  <dt>Access fee</dt>
                  <dd>{selectedRiskState.accessFee}</dd>
                </div>
                <div>
                  <dt>Protected value</dt>
                  <dd>{selectedRiskState.protectedValue}</dd>
                </div>
                <div>
                  <dt>Current value</dt>
                  <dd>{selectedRiskState.totalValue}</dd>
                </div>
                <div>
                  <dt>Loss buffer left</dt>
                  <dd>{selectedRiskState.lossBufferRemaining}</dd>
                </div>
                <div>
                  <dt>Emergency tx</dt>
                  <dd>{selectedRiskState.latestEvent?.emergencyTxHash ? shortAddress(selectedRiskState.latestEvent.emergencyTxHash) : "None"}</dd>
                </div>
              </dl>
            ) : (
              <p className="mutedText">Run the risk setup script to attach Fundz capital, agent margin, and emergency-exit limits.</p>
            )}
          </section>

          <section className="railPanel executionFocus">
            <SectionHeader eyebrow="Execution" title="Latest" meta={<span>{agentExecutions.length}</span>} />
            {latestExecution ? (
              <>
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
                <p>{latestExecution.errorMessage ?? "Execution is inside the Safe pipeline."}</p>
              </>
            ) : (
              <div className="emptyState">Connect the agent wallet or execute a trade to view the latest execution.</div>
            )}
          </section>
        </aside>
      </section>

      <section className="workspacePanel globalSection">
        <SectionHeader eyebrow="Wallet scope" title="Connected account snapshot" meta={<span>{selectedAgent ? "1" : "0"}</span>} />
        <div className="globalGrid">
          <Metric icon={<WalletCards size={18} />} label="Agents" value={selectedAgent ? "1" : "0"} />
          <Metric icon={<ShieldCheck size={18} />} label="Intents" value={agentIntents.length.toString()} />
          <Metric icon={<ArrowRightLeft size={18} />} label="Executions" value={agentExecutions.length.toString()} />
        </div>
        <AgentTable agents={selectedAgent ? [selectedAgent] : []} />
      </section>
    </main>
  );
}
