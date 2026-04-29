import { z } from "zod";
import {
  addressSchema,
  amountSchema,
  chainIdSchema,
  isoDateTimeSchema
} from "./common.js";

export const intentActionSchema = z.literal("uniswap.swap");

export const unsignedIntentSchema = z.object({
  agentId: z.string().uuid(),
  nonce: z.string().min(1),
  action: intentActionSchema,
  chainId: chainIdSchema,
  tokenIn: addressSchema,
  tokenOut: addressSchema,
  amountIn: amountSchema,
  maxSlippageBps: z.number().int().min(0).max(10_000),
  deadline: isoDateTimeSchema
});

export const signedIntentSchema = unsignedIntentSchema.extend({
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Expected a hex signature").optional()
});

export const intentStatusSchema = z.enum([
  "received",
  "policy_approved",
  "policy_rejected",
  "executing",
  "executed",
  "failed"
]);

export const storedIntentSchema = unsignedIntentSchema.extend({
  id: z.string().uuid(),
  signature: z.string().nullable(),
  status: intentStatusSchema,
  rejectionReason: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export type IntentAction = z.infer<typeof intentActionSchema>;
export type UnsignedIntent = z.infer<typeof unsignedIntentSchema>;
export type SignedIntent = z.infer<typeof signedIntentSchema>;
export type IntentStatus = z.infer<typeof intentStatusSchema>;
export type StoredIntent = z.infer<typeof storedIntentSchema>;
