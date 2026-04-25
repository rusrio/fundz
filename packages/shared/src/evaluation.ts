import { z } from "zod";
import { isoDateTimeSchema } from "./common.js";

export const policyCheckCodeSchema = z.enum([
  "token_not_allowed",
  "amount_exceeds_max",
  "cooldown_active",
  "daily_limit_exceeded",
  "deadline_expired"
]);

export const policyEvaluationSchema = z.object({
  intentId: z.string().uuid(),
  approved: z.boolean(),
  reasons: z.array(policyCheckCodeSchema),
  evaluatedAt: isoDateTimeSchema
});

export type PolicyCheckCode = z.infer<typeof policyCheckCodeSchema>;
export type PolicyEvaluation = z.infer<typeof policyEvaluationSchema>;
