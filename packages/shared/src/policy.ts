import { z } from "zod";
import { addressSchema, amountSchema, chainIdSchema, isoDateTimeSchema } from "./common.js";

export const policySchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  chainId: chainIdSchema,
  allowedTokenAddresses: z.array(addressSchema).min(1),
  maxAmountPerOperation: amountSchema,
  cooldownSeconds: z.number().int().nonnegative(),
  dailyLimit: amountSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const policyViewSchema = policySchema.pick({
  chainId: true,
  allowedTokenAddresses: true,
  maxAmountPerOperation: true,
  cooldownSeconds: true,
  dailyLimit: true
});

export type Policy = z.infer<typeof policySchema>;
export type PolicyView = z.infer<typeof policyViewSchema>;
