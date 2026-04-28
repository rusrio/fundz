import { addressSchema } from "@fundz/shared";
import { OperationType, type MetaTransactionData, type TransactionOptions } from "@safe-global/types-kit";

export type AgentSafeLink = {
  agentId: string;
  safeAddress: string;
  mode: "linked";
};

export type SafeExecutorConfig = {
  rpcUrl: string;
  executorPrivateKey: string;
};

export type SafeExecutionRequest = {
  safeAddress: string;
  to: string;
  value?: string;
  data: `0x${string}`;
  operation?: "call" | "delegatecall";
  options?: TransactionOptions;
};

export type SafeExecutionResult = {
  safeAddress: string;
  to: string;
  txHash: string;
  operation: "call" | "delegatecall";
  receiptStatus: "success" | "failed" | "unknown";
};

type ProtocolKit = {
  createTransaction(input: { transactions: MetaTransactionData[]; onlyCalls?: boolean }): Promise<unknown>;
  executeTransaction(safeTransaction: unknown, options?: TransactionOptions): Promise<{ hash: string }>;
};

type SafeSdk = {
  init(config: { provider: string; signer: string; safeAddress: string }): Promise<ProtocolKit>;
};

type RpcTransactionReceipt = {
  status?: "0x0" | "0x1";
};

export function normalizeSafeAddress(safeAddress: string): string {
  return addressSchema.parse(safeAddress);
}

export function linkExistingSafe(input: { agentId: string; safeAddress: string }): AgentSafeLink {
  return {
    agentId: input.agentId,
    safeAddress: normalizeSafeAddress(input.safeAddress),
    mode: "linked"
  };
}

export function getSafeExecutorConfig(): SafeExecutorConfig | null {
  const rpcUrl = process.env.SAFE_RPC_URL;
  const executorPrivateKey = process.env.SAFE_EXECUTOR_PRIVATE_KEY;

  if (!rpcUrl || !executorPrivateKey) {
    return null;
  }

  return { rpcUrl, executorPrivateKey };
}

export function hasSafeExecutorConfig(): boolean {
  return getSafeExecutorConfig() !== null;
}

async function rpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    })
  });

  const body = (await response.json()) as { result?: T; error?: { message?: string } };

  if (!response.ok || body.error) {
    throw new Error(`${method} failed: ${body.error?.message ?? response.statusText}`);
  }

  return body.result as T;
}

async function waitForTransactionReceipt(
  rpcUrl: string,
  txHash: string,
  timeoutMs = Number(process.env.SAFE_RECEIPT_TIMEOUT_MS ?? 15_000)
): Promise<RpcTransactionReceipt | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const receipt = await rpc<RpcTransactionReceipt | null>(rpcUrl, "eth_getTransactionReceipt", [txHash]);

    if (receipt) {
      return receipt;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  return null;
}

export async function executeSafeTransaction(
  request: SafeExecutionRequest,
  config = getSafeExecutorConfig()
): Promise<SafeExecutionResult> {
  if (!config) {
    throw new Error("SAFE_RPC_URL and SAFE_EXECUTOR_PRIVATE_KEY are required for Safe execution");
  }

  const safeAddress = normalizeSafeAddress(request.safeAddress);
  const to = normalizeSafeAddress(request.to);
  const operation = request.operation ?? "call";
  const { default: Safe } = (await import("@safe-global/protocol-kit")) as unknown as {
    default: SafeSdk;
  };

  const protocolKit = await Safe.init({
    provider: config.rpcUrl,
    signer: config.executorPrivateKey,
    safeAddress
  });

  const transaction: MetaTransactionData = {
    to,
    value: request.value ?? "0",
    data: request.data,
    operation: operation === "delegatecall" ? OperationType.DelegateCall : OperationType.Call
  };

  const safeTransaction = await protocolKit.createTransaction({
    transactions: [transaction],
    onlyCalls: operation === "call"
  });

  const response = await protocolKit.executeTransaction(safeTransaction, request.options);
  const receipt = process.env.SAFE_WAIT_FOR_RECEIPT === "false"
    ? null
    : await waitForTransactionReceipt(config.rpcUrl, response.hash);

  if (receipt?.status === "0x0") {
    throw new Error(`Safe transaction reverted: ${response.hash}`);
  }

  return {
    safeAddress,
    to,
    txHash: response.hash,
    operation,
    receiptStatus: receipt?.status === "0x1" ? "success" : "unknown"
  };
}
