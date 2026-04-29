import { motion } from "framer-motion";
import type { FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  CircleDot,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  WalletCards
} from "lucide-react";
import type { Agent, Execution, Policy, StoredIntent } from "@fundz/shared";
import { isAddress, shortAddress, statusClass } from "../lib/format.js";
import type { AgentPerformance, DashboardSnapshot, ReadinessItem, WalletState } from "../types.js";
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
  checklist: ReadinessItem[];
  readyForCapitalAccess: boolean;
  agentName: string;
  safeAddress: string;
  isLoadingDashboard: boolean;
  isRegistering: boolean;
  isLinkingSafe: boolean;
  isSafeFunded: boolean;
  error: string | null;
  setView: (view: "landing" | "app") => void;
  setAgentName: (value: string) => void;
  setSafeAddress: (value: string) => void;
  setIsSafeFunded: (value: boolean) => void;
  loadDashboard: () => void;
  connectWallet: () => void;
  registerConnectedAgent: (event: FormEvent) => void;
  linkSafe: (event: FormEvent) => void;
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
  checklist,
  readyForCapitalAccess,
  agentName,
  safeAddress,
  isLoadingDashboard,
  isRegistering,
  isLinkingSafe,
  isSafeFunded,
  error,
  setView,
  setAgentName,
  setSafeAddress,
  setIsSafeFunded,
  loadDashboard,
  connectWallet,
  registerConnectedAgent,
  linkSafe
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
              : "Connect a wallet, register an agent, and link a funded Safe before signed intents can reach execution."}
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

              <form className="stepBlock" onSubmit={linkSafe}>
                <div className="stepIcon">
                  <LockKeyhole size={18} aria-hidden="true" />
                </div>
                <h3>Link Safe</h3>
                <label>
                  Safe address
                  <input value={safeAddress} onChange={(event) => setSafeAddress(event.target.value)} placeholder="0x..." />
                </label>
                <button className="secondaryButton" type="submit" disabled={isLinkingSafe || !agent || !isAddress(safeAddress)}>
                  {isLinkingSafe ? "Linking..." : "Link existing Safe"}
                </button>
              </form>
            </div>
          </section>

          <section className="workspacePanel">
            <SectionHeader eyebrow="Performance" title="Selected agent" meta={<span>{performance.lastActivity}</span>} />
            <div className="metricsGrid">
              <Metric icon={<Activity size={18} />} label="Intents" value={performance.totalIntents.toString()} />
              <Metric icon={<ShieldCheck size={18} />} label="Approval rate" value={`${performance.approvalRate}%`} tone="positive" />
              <Metric icon={<AlertCircle size={18} />} label="Rejected" value={performance.rejectedCount.toString()} />
              <Metric icon={<ArrowRightLeft size={18} />} label="Amount in" value={performance.totalAmountIn} />
            </div>
            <div className="executionStats">
              <Stat label="Submitted" value={performance.executionsSubmitted} />
              <Stat label="Pending" value={performance.executionsPending} />
              <Stat label="Failed" value={performance.executionsFailed} />
              <Stat label="Latest execution" value={performance.latestExecutionStatus} />
            </div>
          </section>

          <section className="workspacePanel">
            <SectionHeader eyebrow="Activity" title="Agent intents" meta={<span>{agentIntents.length}</span>} />
            <IntentTable intents={agentIntents.length > 0 ? agentIntents : snapshot.intents.slice(0, 6)} />
          </section>
        </div>

        <aside className="sideRail">
          <section className="railPanel">
            <SectionHeader eyebrow="Capital access" title="Readiness" />
            <div className="checklist">
              {checklist.map((item) => (
                <div className={item.complete ? "checkItem complete" : "checkItem"} key={item.label}>
                  {item.complete ? <CheckCircle2 size={17} aria-hidden="true" /> : <CircleDot size={17} aria-hidden="true" />}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <label className="fundingToggle">
              <input
                type="checkbox"
                checked={isSafeFunded}
                disabled={!agent?.safeAddress}
                onChange={(event) => setIsSafeFunded(event.target.checked)}
              />
              Manual Safe deposit confirmed
            </label>
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

          <section className="railPanel executionFocus">
            <SectionHeader eyebrow="Execution" title="Latest" meta={<span>{agentExecutions.length || snapshot.executions.length}</span>} />
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
              <div className="emptyState">No executions yet.</div>
            )}
          </section>
        </aside>
      </section>

      <section className="workspacePanel globalSection">
        <SectionHeader eyebrow="Demo environment" title="Global snapshot" meta={<span>{snapshot.metrics.agentCount}</span>} />
        <div className="globalGrid">
          <Metric icon={<WalletCards size={18} />} label="Agents" value={snapshot.metrics.agentCount.toString()} />
          <Metric icon={<ShieldCheck size={18} />} label="Intents" value={snapshot.metrics.intentCount.toString()} />
          <Metric icon={<ArrowRightLeft size={18} />} label="Executions" value={snapshot.metrics.executionCount.toString()} />
        </div>
        <AgentTable agents={snapshot.agents} />
      </section>
    </main>
  );
}
