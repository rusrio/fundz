import { motion } from "framer-motion";
import type { FormEvent, ReactNode } from "react";
import {
  CheckCircle2,
  CircleDot,
  Copy,
  KeyRound,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  WalletCards
} from "lucide-react";
import type { Agent, Execution, Policy, StoredIntent } from "@fundz/shared";
import {
  formatBaseUnits,
  formatDate,
  formatSignedBps,
  formatTokenUnits,
  formatUsdUnits,
  shortAddress,
  statusClass
} from "../lib/format.js";
import type { PnlHistoryPoint, PortfolioDashboardState, RiskDashboardState, WalletState } from "../types.js";
import { BrandMark } from "./ui.js";

type DashboardProps = {
  wallet: WalletState;
  agent: Agent | null;
  policy: Policy | null;
  selectedAgent: Agent | null;
  agentIntents: StoredIntent[];
  agentExecutions: Execution[];
  latestExecution: Execution | undefined;
  selectedRiskState: RiskDashboardState | null;
  selectedPortfolioState: PortfolioDashboardState | null;
  agentCredentialToken: string | null;
  agentName: string;
  isLoadingDashboard: boolean;
  lastDashboardUpdatedAt: string | null;
  dashboardRefreshMs: number;
  isRegistering: boolean;
  isRequestingPayout: boolean;
  payoutResult: string | null;
  error: string | null;
  setView: (view: "landing" | "app") => void;
  setAgentName: (value: string) => void;
  loadDashboard: () => void;
  connectWallet: () => void;
  disconnectWallet: () => void;
  registerConnectedAgent: (event: FormEvent) => void;
  requestPayout: () => void;
};

export function Dashboard({
  wallet,
  agent,
  policy,
  selectedAgent,
  agentIntents,
  agentExecutions,
  latestExecution,
  selectedRiskState,
  selectedPortfolioState,
  agentCredentialToken,
  agentName,
  isLoadingDashboard,
  lastDashboardUpdatedAt,
  dashboardRefreshMs,
  isRegistering,
  isRequestingPayout,
  payoutResult,
  error,
  setView,
  setAgentName,
  loadDashboard,
  connectWallet,
  disconnectWallet,
  registerConnectedAgent,
  requestPayout
}: DashboardProps) {
  const p = selectedPortfolioState;
  const risk = selectedRiskState;
  const credentialState = selectedAgent?.status === "disabled" ? "Revoked" : selectedAgent ? "Active" : "Not issued";
  const activePolicy = Boolean(policy);
  const readyForCapitalAccess = wallet.status === "connected" && Boolean(selectedAgent?.safeAddress) && activePolicy;
  const latestExecutionStatus = latestExecution?.status ?? (selectedAgent ? "No executions" : "No agent");
  const claimablePayout = risk?.claimablePayout ?? "0";
  const totalPayoutReceived = risk?.totalPayoutReceived ?? "0";
  const hasClaimablePayout = BigInt(claimablePayout) > 0n;

  return (
    <main className="terminalShell">
      <section className="terminalMain">
        <header className="terminalTopbar">
          <div className="topbarBrandCluster">
            <button className="brandMarkButton" type="button" onClick={() => setView("landing")} aria-label="Back to landing">
              <BrandMark />
            </button>
            <nav className="appTabs" aria-label="Fundz dashboard sections">
              <span className="active">Dashboard</span>
              <span>Policy</span>
              <span>Risk</span>
            </nav>
          </div>
          <div className="topbarContext">
            <span className={readyForCapitalAccess ? "status statusPositive" : "status"}>{readyForCapitalAccess ? "Ready" : "Locked"}</span>
            <strong>{selectedAgent ? selectedAgent.name : "No agent selected"}</strong>
          </div>
          <div className="topbarActions">
            <span className="liveSyncStatus" title={`Updates every ${Math.round(dashboardRefreshMs / 1000)} seconds`}>
              <CircleDot size={13} aria-hidden="true" />
              {lastDashboardUpdatedAt ? `Live ${formatDate(lastDashboardUpdatedAt)}` : "Live sync"}
            </span>
            <button className="ghostButton compact" type="button" onClick={loadDashboard} disabled={isLoadingDashboard}>
              <RefreshCw className={isLoadingDashboard ? "spinIcon" : undefined} size={15} aria-hidden="true" />
              Refresh
            </button>
            <button className="primaryButton compact" type="button" onClick={connectWallet} disabled={wallet.status === "connecting"}>
              <WalletCards size={15} aria-hidden="true" />
              {wallet.account ? shortAddress(wallet.account) : "Connect wallet"}
            </button>
            {wallet.account ? (
              <button className="ghostButton compact" type="button" onClick={disconnectWallet}>
                <LogOut size={15} aria-hidden="true" />
                Disconnect
              </button>
            ) : null}
          </div>
        </header>

        {error ? <div className="errorBanner">API unavailable: {error}</div> : null}
        {wallet.error ? <div className="warningBanner">{wallet.error}</div> : null}

        <motion.section
          className="terminalHeader"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div>
            <h1>{selectedAgent?.name ?? "Register an agent to request capital"}</h1>
            <p>
              {selectedAgent
                ? `Owner ${shortAddress(selectedAgent.ownerAddress)} operates from Fundz Safe ${shortAddress(selectedAgent.safeAddress)}.`
                : "Connect the wallet that will own the agent. Fundz assigns the funded Safe automatically at registration."}
            </p>
          </div>
          <div className="headerBadges">
            <span className={statusClass(selectedAgent?.status ?? "pending")}>{selectedAgent?.status ?? "not registered"}</span>
            <span className={activePolicy ? "status statusPositive" : "status"}>{activePolicy ? "policy active" : "policy pending"}</span>
          </div>
        </motion.section>

        <section className="overviewGrid">
          <MetricTile label="Portfolio value" value={formatUsdUnits(p?.totalValue)} signal={p ? `${formatSignedBps(p.pnlBps)} delta` : "Connect wallet"} tone="positive" />
          <MetricTile label="Fundz capital" value={formatUsdUnits(risk?.protocolCapital)} signal="Locked" />
          <MetricTile label="Agent margin" value={formatUsdUnits(risk?.agentLossMargin)} signal={`${formatUsdUnits(risk?.lossBufferRemaining)} left`} />
          <MetricTile label="Portfolio delta" value={p ? formatUsdUnits(p.pnl) : "$0"} signal={latestExecutionStatus} tone={p && p.pnl.startsWith("-") ? "negative" : "positive"} />
          <MetricTile label="Payout received" value={formatUsdUnits(totalPayoutReceived)} signal="Paid to agent" tone={BigInt(totalPayoutReceived) > 0n ? "positive" : undefined} />
        </section>

        <section className="contentGrid">
          <div className="workspaceStack">
            <section className="terminalPanel setupPanel">
              <PanelHeader title="Agent access path" eyebrow="Setup" meta={credentialState} />
              <div className="setupGrid">
                <SetupStep icon={<KeyRound size={17} />} title="Connect wallet" complete={wallet.status === "connected"}>
                  <p>The connected account becomes the agent owner.</p>
                  <button className="secondaryButton" type="button" onClick={connectWallet} disabled={wallet.status === "connecting"}>
                    {wallet.account ? shortAddress(wallet.account) : "Connect wallet"}
                  </button>
                  {wallet.account ? (
                    <button className="ghostButton" type="button" onClick={disconnectWallet}>
                      <LogOut size={15} aria-hidden="true" />
                      Disconnect wallet
                    </button>
                  ) : null}
                </SetupStep>

                <form className="setupStep" onSubmit={registerConnectedAgent}>
                  <div className={agent ? "stepStatus complete" : "stepStatus"}>
                    {agent ? <CheckCircle2 size={16} /> : <CircleDot size={16} />}
                  </div>
                  <ShieldCheck size={17} aria-hidden="true" />
                  <h3>Register agent</h3>
                  <label>
                    Agent name
                    <input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="OpenClaw Agent" />
                  </label>
                  <button className="secondaryButton" type="submit" disabled={isRegistering || !wallet.account || agentName.trim().length === 0}>
                    {agent ? "Update agent" : isRegistering ? "Registering" : "Register agent"}
                  </button>
                </form>

                <SetupStep icon={<LockKeyhole size={17} />} title="Funded Safe" complete={Boolean(agent?.safeAddress)}>
                  <p>Fundz assigns the funded Safe during registration.</p>
                  <AddressLine label="Assigned Safe" value={agent?.safeAddress ?? null} />
                </SetupStep>
              </div>
            </section>

            <section className="terminalPanel">
              <PanelHeader
                title="Portfolio delta"
                eyebrow="Performance"
                meta={p?.pnlHistory.length ? `${p.pnlHistory.length} snapshots` : "No history"}
              />
              {p?.pnlHistory.length ? (
                <PnlChart history={p.pnlHistory} />
              ) : (
                <EmptyState title="No delta history" body="Run the risk monitor to record valuation snapshots, then refresh this dashboard." />
              )}
            </section>

            <section className="terminalPanel">
              <PanelHeader title="Risk budget utilization" eyebrow="Capital protection" meta={risk ? "Enforced" : "Not configured"} />
              {risk ? (
                <>
                  <div className="riskMeta">
                    <span>Capital allocation</span>
                    <strong>Current: {formatUsdUnits(risk.totalValue)}</strong>
                  </div>
                  <div className="riskBar" aria-label="Risk budget utilization">
                    <div className="riskBarFundz" style={{ flexGrow: Number(BigInt(risk.protocolCapital) / 1000000n) || 1 }}>Fundz capital</div>
                    <div className="riskBarMargin" style={{ flexGrow: Number(BigInt(risk.agentLossMargin) / 1000000n) || 1 }}>Margin</div>
                    <div className="riskBarFee" style={{ flexGrow: Number(BigInt(risk.accessFee) / 1000000n) || 1 }}>Fee</div>
                  </div>
                  <div className="riskLegend">
                    <span><i className="legendFundz" />Protected: {formatUsdUnits(risk.protectedValue)}</span>
                    <span><i className="legendMargin" />Buffer left: {formatUsdUnits(risk.lossBufferRemaining)}</span>
                    <span><i className="legendFee" />Access fee: {formatUsdUnits(risk.accessFee)}</span>
                  </div>
                  <div className="payoutBox">
                    <div>
                      <span>Claimable payout</span>
                      <strong>{formatUsdUnits(risk.claimablePayout)}</strong>
                      <p>
                        {(risk.payoutShareBps / 100).toFixed(0)}% of positive portfolio delta, paid to the connected owner wallet.
                        Total received: {formatUsdUnits(risk.totalPayoutReceived)}.
                      </p>
                    </div>
                    <button className="primaryButton compact" type="button" onClick={requestPayout} disabled={!hasClaimablePayout || isRequestingPayout}>
                      {isRequestingPayout ? "Requesting" : "Request payout"}
                    </button>
                  </div>
                  {payoutResult ? <div className="successBanner">{payoutResult}</div> : null}
                </>
              ) : (
                <EmptyState title="No risk policy" body="Run the risk setup script to attach Fundz capital, agent margin, and emergency exit limits." />
              )}
            </section>

            <section className="terminalPanel">
              <PanelHeader title="Open positions" eyebrow="Portfolio" meta={p ? `${p.positions.length} assets` : "No valuation"} />
              {p?.error ? <div className="warningBanner inlineWarning">{p.error}</div> : null}
              {p ? (
                <div className="positionsTableWrap">
                  <table className="positionsTable">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Balance</th>
                        <th>USDC value</th>
                        <th>Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.positions.map((position) => (
                        <tr key={position.address}>
                          <td><strong>{position.symbol}</strong></td>
                          <td>{formatTokenUnits(position.balance, position.decimals)}</td>
                          <td>{formatUsdUnits(position.valueInBase)}</td>
                          <td>{shortAddress(position.address)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No portfolio valuation" body="Connect the wallet that owns the agent to view Safe balances and Uniswap-valued positions." />
              )}
            </section>

            <section className="terminalPanel">
              <PanelHeader title="Agent activity" eyebrow="Activity" meta={`${agentIntents.length} intents`} />
              {selectedAgent ? (
                <ActivityTable intents={agentIntents} executions={agentExecutions} />
              ) : (
                <EmptyState title="No wallet scope" body="Connect the wallet that owns the agent. Global activity is intentionally hidden." />
              )}
            </section>
          </div>

          <aside className="inspectorRail">
            <section className="terminalPanel">
              <PanelHeader title="Active policy" eyebrow="Policy engine" meta={policy ? "Enforced" : "Pending"} />
              {policy ? (
                <dl className="definitionList">
                  <div><dt>Chain</dt><dd>Ethereum fork</dd></div>
                  <div><dt>Max trade size</dt><dd>{formatUsdUnits(policy.maxAmountPerOperation)}</dd></div>
                  <div><dt>Daily limit</dt><dd>{formatUsdUnits(policy.dailyLimit)}</dd></div>
                  <div><dt>Cooldown</dt><dd>{policy.cooldownSeconds}s</dd></div>
                  <div><dt>Allowed assets</dt><dd>{policy.allowedTokenAddresses.map(shortAddress).join(", ")}</dd></div>
                </dl>
              ) : (
                <EmptyState title="No policy" body="Register the connected wallet as an agent to create the default demo policy." />
              )}
            </section>

            <section className="terminalPanel">
              <PanelHeader title="Agent identity" eyebrow="Credential" meta={credentialState} />
              <div className="identityBlock">
                {agentCredentialToken ? (
                  <div className="credentialReveal">
                    <span>New agent token</span>
                    <strong>{agentCredentialToken}</strong>
                    <p>Save this token for MCP/OpenClaw. Fundz stores only its hash and cannot show it again.</p>
                  </div>
                ) : null}
                <AddressLine label="Owner" value={selectedAgent?.ownerAddress ?? null} />
                <AddressLine label="Safe" value={selectedAgent?.safeAddress ?? null} />
                <AddressLine label="Credential" value={credentialState} plain />
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}

function MetricTile({ label, value, signal, tone }: { label: string; value: string; signal: string; tone?: "positive" | "negative" }) {
  return (
    <article className={tone ? `metricTile ${tone}` : "metricTile"}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{signal}</small>
    </article>
  );
}

function PanelHeader({ title, meta }: { eyebrow?: string; title: string; meta?: string }) {
  return (
    <header className="panelHeader">
      <div>
        <h2>{title}</h2>
      </div>
      {meta ? <span>{meta}</span> : null}
    </header>
  );
}

function SetupStep({ icon, title, complete, children }: { icon: ReactNode; title: string; complete: boolean; children: ReactNode }) {
  return (
    <div className="setupStep">
      <div className={complete ? "stepStatus complete" : "stepStatus"}>
        {complete ? <CheckCircle2 size={16} /> : <CircleDot size={16} />}
      </div>
      {icon}
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function AddressLine({ label, value, plain = false }: { label: string; value: string | null; plain?: boolean }) {
  return (
    <div className="addressLine">
      <span>{label}</span>
      <strong>{plain ? value ?? "Not issued" : shortAddress(value)}</strong>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="emptyState">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function baseUnitsToNumber(value: string): number {
  try {
    return Number(BigInt(value)) / 1_000_000;
  } catch {
    return 0;
  }
}

function PnlChart({ history }: { history: PnlHistoryPoint[] }) {
  const width = 720;
  const height = 260;
  const padding = { top: 18, right: 18, bottom: 42, left: 58 };
  const values = history.map((point) => baseUnitsToNumber(point.pnl));
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue === minValue ? 1 : maxValue - minValue;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xFor = (index: number) => padding.left + (history.length === 1 ? chartWidth : (index / (history.length - 1)) * chartWidth);
  const yFor = (value: number) => padding.top + ((maxValue - value) / range) * chartHeight;
  const points = values.map((value, index) => ({ x: xFor(index), y: yFor(value), source: history[index]! }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const zeroY = yFor(0);
  const areaPath = `${linePath} L ${points[points.length - 1]!.x.toFixed(2)} ${zeroY.toFixed(2)} L ${points[0]!.x.toFixed(2)} ${zeroY.toFixed(2)} Z`;
  const latest = history[history.length - 1]!;
  const first = history[0]!;
  const tone = latest.pnl.startsWith("-") ? "negative" : "positive";

  return (
    <div className="pnlChart">
      <div className="pnlChartSummary">
        <div>
          <span>Latest delta</span>
          <strong className={tone}>{formatUsdUnits(latest.pnl)}</strong>
        </div>
        <div>
          <span>Return</span>
          <strong className={tone}>{formatSignedBps(latest.pnlBps)}</strong>
        </div>
        <div>
          <span>Total value</span>
          <strong>{formatUsdUnits(latest.totalValue)}</strong>
        </div>
      </div>
      <svg className="pnlChartSvg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Portfolio delta history">
        <line className="pnlAxis" x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} />
        <line className="pnlGrid" x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top} />
        <line className="pnlGrid" x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} />
        <text className="pnlAxisLabel" x={padding.left - 10} y={padding.top + 4} textAnchor="end">{formatUsdUnits(String(Math.round(maxValue * 1_000_000)))}</text>
        <text className="pnlAxisLabel" x={padding.left - 10} y={height - padding.bottom + 4} textAnchor="end">{formatUsdUnits(String(Math.round(minValue * 1_000_000)))}</text>
        <path className={`pnlArea ${tone}`} d={areaPath} />
        <path className={`pnlLine ${tone}`} d={linePath} />
        {points.map((point) => (
          <circle
            className={point.source.breached ? "pnlPoint breached" : "pnlPoint"}
            cx={point.x}
            cy={point.y}
            r={point.source.breached ? 5 : 3.5}
            key={point.source.createdAt}
          />
        ))}
        <text className="pnlDateLabel" x={padding.left} y={height - 12}>{formatDate(first.createdAt)}</text>
        <text className="pnlDateLabel" x={width - padding.right} y={height - 12} textAnchor="end">{formatDate(latest.createdAt)}</text>
      </svg>
    </div>
  );
}

function ActivityTable({ intents, executions }: { intents: StoredIntent[]; executions: Execution[] }) {
  if (intents.length === 0 && executions.length === 0) {
    return <EmptyState title="No activity yet" body="Ask OpenClaw to submit an intent through the MCP, then refresh this dashboard." />;
  }

  const executionByIntent = new Map(executions.map((execution) => [execution.intentId, execution]));
  const rows = intents
    .map((intent) => activityRow(intent, executionByIntent.get(intent.id)))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const copyTx = (txHash: string) => {
    void navigator.clipboard?.writeText(txHash);
  };

  return (
    <div className="activityTableWrap">
      <table className="activityTable">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{formatDate(row.time)}</td>
              <td>
                <span className="activityAction">
                  <strong>{row.label}</strong>
                  {row.txHash ? (
                    <button className="copyTxButton" type="button" onClick={() => copyTx(row.txHash!)} title="Copy transaction hash" aria-label="Copy transaction hash">
                      <Copy size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </span>
                <span>{row.detail}</span>
              </td>
              <td>{row.value}</td>
              <td><span className={statusClass(row.status)}>{row.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function activityRow(intent: StoredIntent, execution: Execution | undefined) {
  const tokenIn = tokenSymbol(intent.tokenIn);
  const tokenOut = tokenSymbol(intent.tokenOut);
  const amountIn = `${formatTokenAmount(intent.amountIn, intent.tokenIn, 2)} ${tokenIn}`;
  const amountOut = execution?.amountOut ? `${formatTokenAmount(execution.amountOut, intent.tokenOut, 6)} ${tokenOut}` : null;
  const status = execution?.status ?? intent.status;

  if (intent.status === "policy_rejected") {
    return {
      id: intent.id,
      time: intent.updatedAt,
      label: `Blocked ${tokenIn} to ${tokenOut} swap`,
      detail: `Policy rejected this request: ${humanPolicyReason(intent.rejectionReason)}`,
      value: amountIn,
      txHash: null,
      status
    };
  }

  return {
    id: intent.id,
    time: execution?.updatedAt ?? intent.updatedAt,
    label: amountOut ? `Bought ${amountOut} with ${amountIn}` : `Buying ${tokenOut} with ${amountIn}`,
    detail: execution?.txHash
      ? `Safe transaction ${shortAddress(execution.txHash)}`
      : execution?.errorMessage ?? "Policy approved. Waiting for Safe execution.",
    value: amountOut ? `${amountIn} -> ${amountOut}` : amountIn,
    txHash: execution?.txHash ?? null,
    status
  };
}

function tokenSymbol(address: string): string {
  const symbols: Record<string, string> = {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "WBTC",
    "0x1f9840a85d5af5bf1d1762f925bddadc4201f984": "UNI"
  };

  return symbols[address.toLowerCase()] ?? shortAddress(address);
}

function tokenDecimals(address: string): number {
  const decimals: Record<string, number> = {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": 6,
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": 18,
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": 8,
    "0x1f9840a85d5af5bf1d1762f925bddadc4201f984": 18
  };

  return decimals[address.toLowerCase()] ?? 18;
}

function formatTokenAmount(value: string, tokenAddress: string, maximumFractionDigits: number): string {
  return formatBaseUnits(value, tokenDecimals(tokenAddress), maximumFractionDigits);
}

function humanPolicyReason(reason: string | null): string {
  const reasons: Record<string, string> = {
    amount_exceeds_max: "amount is above the per-trade limit",
    daily_limit_exceeded: "daily capacity would be exceeded",
    cooldown_active: "cooldown window is still active",
    token_not_allowed: "one of the assets is not allowlisted",
    chain_not_allowed: "chain is not allowed"
  };

  return reason ? reasons[reason] ?? reason.replaceAll("_", " ") : "policy rule failed";
}
