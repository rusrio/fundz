import { z } from "zod";
import {
  addressSchema,
  amountSchema,
  chainIdSchema,
  isoDateTimeSchema,
  signatureSchema
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
  signature: signatureSchema
});

export const intentStatusSchema = z.enum([
  "received",
  "policy_approved",
  "policy_rejected",
  "executing",
  "executed",
  "failed"
]);

export const storedIntentSchema = signedIntentSchema.extend({
  id: z.string().uuid(),
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
