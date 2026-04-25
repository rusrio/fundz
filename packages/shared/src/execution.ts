import { z } from "zod";
import { addressSchema, amountSchema, isoDateTimeSchema } from "./common.js";

export const executionStatusSchema = z.enum(["pending", "submitted", "confirmed", "failed"]);

export const executionSchema = z.object({
  id: z.string().uuid(),
  intentId: z.string().uuid(),
  agentId: z.string().uuid(),
  safeAddress: addressSchema,
  adapter: z.literal("uniswap"),
  status: executionStatusSchema,
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).nullable(),
  amountIn: amountSchema,
  amountOut: amountSchema.nullable(),
  errorMessage: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export type ExecutionStatus = z.infer<typeof executionStatusSchema>;
export type Execution = z.infer<typeof executionSchema>;
