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
    estimatedRevenueRecovery: z.preprocess(
      normalizeEstimatedRevenueRecovery,
      z.string().regex(/^\d+(?:\.\d{1,4})?$/)
    )
  }).strict(),
  assumptions: z.array(z.string().min(1).max(500)).max(20),
  risks: z.array(z.string().min(1).max(500)).max(20),
  confidence: z.preprocess(normalizeConfidence, z.number().min(0).max(100)),
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
        systemPrompt: 'Return only JSON matching the supplied response schema. Use every property exactly as named. Confidence must be a percentage number from 0 to 100, not a fraction from 0 to 1. Do not include markdown, explanations, secrets, or personal data.',
        userPrompt: JSON.stringify(context),
        responseJsonSchema: strategyResponseSchema
      });
    } catch (error) {
      logger.error({ providerError: error instanceof Error ? error.message : 'unknown provider error' }, 'Strategy generation failed');
      throw new AppError(502, 'AI_PROVIDER_UNAVAILABLE', 'Strategy generation service is unavailable');
    }

    const parsed = strategySchema.safeParse(raw);
    if (!parsed.success) {
      logger.error({
        issueCount: parsed.error.issues.length,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      }, 'AI strategy response failed validation');
      throw new AppError(502, 'INVALID_AI_RESPONSE', 'Strategy generation returned an invalid response');
    }
    return parsed.data;
  }
}

export { strategySchema };

function normalizeEstimatedRevenueRecovery(value: unknown): unknown {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? String(value) : value;
  }
  if (typeof value !== 'string') return value;

  const normalized = value.trim()
    .replace(/,/g, '')
    .replace(/^(?:[$€£₹]|[A-Za-z]{3})\s*/, '')
    .replace(/\s*(?:[A-Za-z]{3})$/, '');
  return normalized;
}

function normalizeConfidence(value: unknown): unknown {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value * 100 : value;
  }
  if (typeof value !== 'string') return value;

  const hasPercentSign = value.includes('%');
  const confidence = Number(value.replace('%', '').trim());
  if (!Number.isFinite(confidence)) return value;
  return !hasPercentSign && confidence >= 0 && confidence <= 1 ? confidence * 100 : confidence;
}

const strategyResponseSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['objective', 'targetSegment', 'trigger', 'actions', 'expectedImpact', 'assumptions', 'risks', 'confidence', 'reasoning'],
  properties: {
    objective: { type: 'string' },
    targetSegment: { type: 'string' },
    trigger: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'conditions'],
      properties: {
        type: { type: 'string' },
        conditions: { type: 'array', items: { type: 'string' } }
      }
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'parameters'],
        properties: {
          action: { type: 'string' },
          parameters: { type: 'object', additionalProperties: true }
        }
      }
    },
    expectedImpact: {
      type: 'object',
      additionalProperties: false,
      required: ['successRateLiftPercentage', 'revenueRecoveryPercentage', 'estimatedRevenueRecovery'],
      properties: {
        successRateLiftPercentage: { type: 'number' },
        revenueRecoveryPercentage: { type: 'number' },
        estimatedRevenueRecovery: { type: 'string' }
      }
    },
    assumptions: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    reasoning: { type: 'string' }
  }
};
