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
        systemPrompt: 'Return only JSON matching the supplied response schema. Use every property exactly as named. Do not include markdown or explanations. Do not authorize execution.',
        userPrompt: JSON.stringify(context),
        responseJsonSchema: advisoryResponseSchema
      });
    } catch (error) {
      logger.error({ providerError: error instanceof Error ? error.message : 'unknown provider error' }, 'Advisory review failed');
      throw new AppError(502, 'AI_PROVIDER_UNAVAILABLE', 'Advisory review service is unavailable');
    }

    const parsed = advisorySchema.safeParse(normalizeAdvisoryResponse(raw));
    if (!parsed.success) {
      logger.error({
        issueCount: parsed.error.issues.length,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      }, 'AI advisory response failed validation');
      throw new AppError(502, 'INVALID_AI_RESPONSE', 'Advisory review returned an invalid response');
    }
    return parsed.data;
  }
}

export { advisorySchema };

function normalizeAdvisoryResponse(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const response = { ...(value as Record<string, unknown>) };

  if (typeof response.decision === 'string') {
    response.decision = response.decision.trim().toUpperCase();
  }
  if (typeof response.riskLevel === 'string') {
    response.riskLevel = response.riskLevel.trim().toLowerCase();
  }
  if (typeof response.confidence === 'string') {
    const confidence = Number(response.confidence.replace('%', '').trim());
    if (Number.isFinite(confidence)) response.confidence = confidence;
  } else if (typeof response.confidence === 'number' && response.confidence >= 0 && response.confidence <= 1) {
    response.confidence *= 100;
  }

  for (const key of ['concerns', 'recommendations', 'assumptionIssues']) {
    const items = response[key];
    if (typeof items === 'string') response[key] = [items];
  }
  return response;
}

const advisoryResponseSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'confidence', 'concerns', 'recommendations', 'assumptionIssues', 'riskLevel'],
  properties: {
    decision: { type: 'string', enum: ['APPROVE', 'MODIFY', 'REJECT'] },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    concerns: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
    assumptionIssues: { type: 'array', items: { type: 'string' } },
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
  }
};
