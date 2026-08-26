import { z } from 'zod';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/app-error.js';
import type { AIProvider } from './provider.js';

const strategySchema = z.object({
  objective: z.string().min(1).max(2000),
  targetSegment: z.string().min(1).max(1000),
  trigger: z.object({
    type: z.string().min(1).max(100),
    conditions: z.array(z.string().min(1).max(500)).min(1).max(20)
  }).strict(),
  actions: z.array(z.object({
    action: z.string().min(1).max(200),
    parameters: z.record(z.string(), z.unknown()).default({})
  }).strict()).min(1).max(20),
  expectedImpact: z.object({
    successRateLiftPercentage: z.number().min(0).max(100),
    revenueRecoveryPercentage: z.number().min(0).max(100),
    estimatedRevenueRecovery: z.string().regex(/^\d+(?:\.\d{1,4})?$/)
  }).strict(),
  assumptions: z.array(z.string().min(1).max(500)).max(20),
  risks: z.array(z.string().min(1).max(500)).max(20),
  confidence: z.number().min(0).max(100),
  reasoning: z.string().min(1).max(4000)
}).strict();

export type StrategyOutput = z.infer<typeof strategySchema>;

export interface StrategyGenerationContext {
  opportunity: Record<string, unknown>;
  relevantAnalytics: Record<string, unknown>;
  merchantContext: Record<string, unknown>;
  historicalEvidence: Record<string, unknown>;
}

export class StrategyGenerator {
  constructor(private readonly provider: AIProvider) {}

  async generate(context: StrategyGenerationContext): Promise<StrategyOutput> {
    let raw: unknown;
    try {
      raw = await this.provider.generateStructured({
        systemPrompt: 'Return only valid JSON matching the requested strategy schema. Do not include secrets or personal data.',
        userPrompt: JSON.stringify(context)
      });
    } catch (error) {
      logger.error({ providerError: error instanceof Error ? error.message : 'unknown provider error' }, 'Strategy generation failed');
      throw new AppError(502, 'AI_PROVIDER_UNAVAILABLE', 'Strategy generation service is unavailable');
    }

    const parsed = strategySchema.safeParse(raw);
    if (!parsed.success) {
      logger.error({ issueCount: parsed.error.issues.length }, 'AI strategy response failed validation');
      throw new AppError(502, 'INVALID_AI_RESPONSE', 'Strategy generation returned an invalid response');
    }
    return parsed.data;
  }
}

export { strategySchema };
