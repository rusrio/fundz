import type { Agent, Execution, StoredIntent } from "@fundz/shared";
import type { AgentPerformance, DashboardSnapshot } from "../types.js";

export function shortAddress(value: string | null): string {
  if (!value) {
    return "Not linked";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "No activity";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function statusClass(status: string): string {
  if (status.includes("approved") || status === "confirmed" || status === "submitted" || status === "active") {
    return "status statusPositive";
  }

  if (status.includes("rejected") || status === "failed" || status === "disabled") {
    return "status statusNegative";
  }

  return "status";
}

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function computePerformance(agent: Agent | null, snapshot: DashboardSnapshot): AgentPerformance {
  if (!agent) {
    return {
      totalIntents: 0,
      approvalRate: 0,
      rejectedCount: 0,
      executionsSubmitted: 0,
      executionsPending: 0,
      executionsFailed: 0,
      totalAmountIn: "0",
      latestExecutionStatus: "No agent",
      lastActivity: "No activity"
    };
  }

  const intents = snapshot.intents.filter((intent: StoredIntent) => intent.agentId === agent.id);
  const executions = snapshot.executions.filter((execution: Execution) => execution.agentId === agent.id);
  const approvedCount = intents.filter((intent) => intent.status === "policy_approved").length;
  const rejectedCount = intents.filter((intent) => intent.status === "policy_rejected").length;
  const totalAmountIn = intents.reduce((sum, intent) => sum + BigInt(intent.amountIn), 0n).toString();
  const latestExecution = executions[0];
  const activityDates = [...intents.map((intent) => intent.updatedAt), ...executions.map((execution) => execution.updatedAt)]
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  const latestActivity = activityDates.length > 0 ? new Date(Math.max(...activityDates)).toISOString() : null;

  return {
    totalIntents: intents.length,
    approvalRate: intents.length > 0 ? Math.round((approvedCount / intents.length) * 100) : 0,
    rejectedCount,
    executionsSubmitted: executions.filter((execution) => execution.status === "submitted").length,
    executionsPending: executions.filter((execution) => execution.status === "pending").length,
    executionsFailed: executions.filter((execution) => execution.status === "failed").length,
    totalAmountIn,
    latestExecutionStatus: latestExecution?.status ?? "No executions",
    lastActivity: formatDate(latestActivity)
  };
}
