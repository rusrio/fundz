import { z } from "zod";

export const isoDateTimeSchema = z.string().datetime();

export const chainIdSchema = z.number().int().positive();

export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected an EVM address");

export const signatureSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, "Expected a hex signature");

export const amountSchema = z
  .string()
  .regex(/^[0-9]+$/, "Expected a base-unit integer amount");

export const tokenAmountSchema = z.object({
  token: addressSchema,
  amount: amountSchema
});

export type TokenAmount = z.infer<typeof tokenAmountSchema>;
