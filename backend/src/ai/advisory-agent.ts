import { z } from 'zod';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/app-error.js';
import type { AIProvider } from './provider.js';

const advisorySchema = z.object({
  decision: z.enum(['APPROVE', 'MODIFY', 'REJECT']),
  confidence: z.number().min(0).max(100),
  concerns: z.array(z.string().min(1).max(500)).max(20),
  recommendations: z.array(z.string().min(1).max(500)).max(20),
  assumptionIssues: z.array(z.string().min(1).max(500)).max(20),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical'])
}).strict();

export type AdvisoryOutput = z.infer<typeof advisorySchema>;

export interface AdvisoryContext {
  strategy: Record<string, unknown>;
  simulation: Record<string, unknown>;
  opportunity: Record<string, unknown>;
  relevantAnalytics: Record<string, unknown>;
}

export class AdvisoryAgent {
  constructor(private readonly provider: AIProvider) {}

  async review(context: AdvisoryContext): Promise<AdvisoryOutput> {
    let raw: unknown;
    try {
      raw = await this.provider.generateStructured({
        systemPrompt: 'Return only valid JSON matching the advisory review schema. Do not authorize execution.',
        userPrompt: JSON.stringify(context)
      });
    } catch (error) {
      logger.error({ providerError: error instanceof Error ? error.message : 'unknown provider error' }, 'Advisory review failed');
      throw new AppError(502, 'AI_PROVIDER_UNAVAILABLE', 'Advisory review service is unavailable');
    }

    const parsed = advisorySchema.safeParse(raw);
    if (!parsed.success) {
      logger.error({ issueCount: parsed.error.issues.length }, 'AI advisory response failed validation');
      throw new AppError(502, 'INVALID_AI_RESPONSE', 'Advisory review returned an invalid response');
    }
    return parsed.data;
  }
}

export { advisorySchema };
