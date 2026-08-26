import { z } from 'zod';

export const policyCheckSchema = z.object({
  policyId: z.string().uuid().optional(),
  executionHour: z.coerce.number().int().min(0).max(23).default(12)
});

export const policyRulesSchema = z.object({
  maxAffectedTransactionPercentage: z.number().min(0).max(100).default(10),
  maxRevenueExposurePercentage: z.number().min(0).max(100).default(25),
  allowedPaymentMethods: z.array(z.enum(['upi', 'card', 'net_banking'])).default(['upi', 'card', 'net_banking']),
  allowedExecutionHours: z.object({ start: z.number().int().min(0).max(23).default(0), end: z.number().int().min(0).max(23).default(23) }).default({ start: 0, end: 23 }),
  maxDailyExecutionAmount: z.string().regex(/^\d+(?:\.\d{1,4})?$/).default('100000.0000'),
  minimumStrategyConfidence: z.number().min(0).max(100).default(60),
  minimumSimulationConfidence: z.number().min(0).max(100).default(60)
}).strict();

export type PolicyCheckInput = z.infer<typeof policyCheckSchema>;
export type PolicyRules = z.infer<typeof policyRulesSchema>;
