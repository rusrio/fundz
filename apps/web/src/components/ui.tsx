import type React from "react";
import type { Agent, StoredIntent } from "@fundz/shared";
import { formatDate, shortAddress, statusClass } from "../lib/format.js";

export function BrandMark({ onClick }: { onClick?: () => void }) {
  if (onClick) {
    return (
      <button className="brandMark brandMarkButton" type="button" onClick={onClick}>
        <span>FZ</span>
        <strong>FUNDZ</strong>
      </button>
    );
  }

  return (
    <div className="brandMark">
      <span>FZ</span>
      <strong>FUNDZ</strong>
    </div>
  );
}

export function Metric({ icon, label, value, tone = "default" }: { icon: React.ReactNode; label: string; value: string; tone?: "default" | "positive" }) {
  return (
    <div className={tone === "positive" ? "metric metricPositive" : "metric"}>
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, meta }: { eyebrow?: string; title: string; meta?: React.ReactNode }) {
  return (
    <div className="sectionHeader">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {meta ? <div className="sectionMeta">{meta}</div> : null}
    </div>
  );
}

export function ProcessStep({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="processStep">
      <span>{index}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function IntentTable({ intents }: { intents: StoredIntent[] }) {
  if (intents.length === 0) {
    return <div className="emptyState">No intents yet.</div>;
  }

  return (
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
          {intents.map((intent) => (
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
  );
}

export function AgentTable({ agents }: { agents: Agent[] }) {
  if (agents.length === 0) {
    return <div className="emptyState">No registered agents yet.</div>;
  }

  return (
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
          {agents.map((agent) => (
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
  );
}
