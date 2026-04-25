import { z } from "zod";
import { addressSchema, isoDateTimeSchema } from "./common.js";
import { policySchema } from "./policy.js";

export const agentStatusSchema = z.enum(["active", "disabled"]);

export const agentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  ownerAddress: addressSchema,
  safeAddress: addressSchema.nullable(),
  status: agentStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const registerAgentRequestSchema = z.object({
  name: z.string().min(1),
  ownerAddress: addressSchema,
  safeAddress: addressSchema.optional()
});

export const registerAgentResponseSchema = z.object({
  agent: agentSchema,
  policy: policySchema
});

export type AgentStatus = z.infer<typeof agentStatusSchema>;
export type Agent = z.infer<typeof agentSchema>;
export type RegisterAgentRequest = z.infer<typeof registerAgentRequestSchema>;
export type RegisterAgentResponse = z.infer<typeof registerAgentResponseSchema>;
