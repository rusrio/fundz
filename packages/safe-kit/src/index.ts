import { addressSchema } from "@fundz/shared";

export type AgentSafeLink = {
  agentId: string;
  safeAddress: string;
  mode: "linked";
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
