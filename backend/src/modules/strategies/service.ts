import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { advisoryReviews, auditLogs, merchants, opportunities, policyResults, simulations, strategies } from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import { merchantIdForUser } from '../../utils/merchant-context.js';
import { StrategyGenerator, type StrategyOutput } from '../../ai/strategy-generator.js';
import { GeminiAIProvider } from '../../ai/provider.js';

const generator = new StrategyGenerator(new GeminiAIProvider());

export class StrategyService {
  async approveForUser(userId: string, strategyId: string) {
    const merchantId = await merchantIdForUser(userId);
    return db.transaction(async (tx) => {
      const [strategy] = await tx.select().from(strategies).where(and(
        eq(strategies.id, strategyId),
        eq(strategies.merchantId, merchantId),
      )).limit(1);
      if (!strategy) throw new AppError(404, 'STRATEGY_NOT_FOUND', 'Strategy not found');
      if (strategy.status !== 'policy_approved') {
        throw new AppError(409, 'STRATEGY_NOT_APPROVABLE', 'Strategy must pass policy checks before merchant approval');
      }

      const [simulation] = await tx.select().from(simulations).where(and(
        eq(simulations.strategyId, strategyId),
        eq(simulations.merchantId, merchantId),
        eq(simulations.status, 'completed'),
      )).orderBy(desc(simulations.createdAt)).limit(1);
      if (!simulation) throw new AppError(409, 'SIMULATION_REQUIRED', 'A completed simulation is required');

      const [advisory] = await tx.select().from(advisoryReviews).where(and(
        eq(advisoryReviews.simulationId, simulation.id),
        eq(advisoryReviews.merchantId, merchantId),
      )).orderBy(desc(advisoryReviews.createdAt)).limit(1);
      if (!advisory) throw new AppError(409, 'ADVISORY_REVIEW_REQUIRED', 'An advisory review is required');

      const [policy] = await tx.select().from(policyResults).where(and(
        eq(policyResults.simulationId, simulation.id),
        eq(policyResults.merchantId, merchantId),
        eq(policyResults.status, 'passed'),
      )).orderBy(desc(policyResults.evaluatedAt)).limit(1);
      if (!policy) throw new AppError(409, 'POLICY_APPROVAL_REQUIRED', 'A passed policy check is required');

      const approvedAt = new Date();
      const [approved] = await tx.update(strategies).set({
        status: 'merchant_approved',
        approvedByUserId: userId,
        updatedAt: approvedAt,
      }).where(and(
        eq(strategies.id, strategyId),
        eq(strategies.status, 'policy_approved'),
      )).returning();
      if (!approved) throw new AppError(409, 'STRATEGY_NOT_APPROVABLE', 'Strategy approval state changed; retry the request');

      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: 'strategy',
        entityId: strategyId,
        action: 'strategy_approved',
        metadata: {
          simulationId: simulation.id,
          policyResultId: policy.id,
          advisoryReviewId: advisory.id,
        },
      });
      return approved;
    });
  }

  async getByIdForUser(userId: string, strategyId: string) {
    const merchantId = await merchantIdForUser(userId);
    const [context] = await db.select({
      strategy: strategies,
      opportunity: opportunities
    }).from(strategies)
      .leftJoin(opportunities, eq(strategies.opportunityId, opportunities.id))
      .where(and(eq(strategies.id, strategyId), eq(strategies.merchantId, merchantId)))
      .limit(1);
    if (!context) throw new AppError(404, 'STRATEGY_NOT_FOUND', 'Strategy not found');
    const [advisoryReview, policyCheck] = await Promise.all([
      db.select().from(advisoryReviews)
        .innerJoin(simulations, eq(advisoryReviews.simulationId, simulations.id))
        .where(and(eq(advisoryReviews.merchantId, merchantId), eq(simulations.strategyId, strategyId)))
        .orderBy(desc(advisoryReviews.createdAt))
        .limit(1),
      db.select().from(policyResults)
        .innerJoin(simulations, eq(policyResults.simulationId, simulations.id))
        .where(and(eq(policyResults.merchantId, merchantId), eq(simulations.strategyId, strategyId)))
        .orderBy(desc(policyResults.evaluatedAt))
        .limit(1)
    ]);
    return {
      ...context.strategy,
      opportunity: context.opportunity ? {
        id: context.opportunity.id,
        name: context.opportunity.title,
        affectedTransactionCount: context.opportunity.affectedTransactionCount,
        estimatedOpportunityValue: context.opportunity.estimatedOpportunityValue
      } : null,
      advisoryReview: advisoryReview[0]?.advisory_reviews ?? null,
      policyCheck: policyCheck[0]?.policy_results ?? null
    };
  }

  async generateForOpportunity(userId: string, opportunityId: string) {
    const merchantId = await merchantIdForUser(userId);
    const [context] = await db.select({
      opportunity: opportunities,
      merchant: merchants
    }).from(opportunities)
      .innerJoin(merchants, eq(opportunities.merchantId, merchants.id))
      .where(eq(opportunities.id, opportunityId))
      .limit(1);
    if (!context || context.opportunity.merchantId !== merchantId) {
      throw new AppError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');
    }

    const generated = await generator.generate({
      opportunity: safeObject(context.opportunity),
      relevantAnalytics: safeObject(context.opportunity.evidence),
      merchantContext: {
        id: context.merchant.id,
        name: context.merchant.name,
        defaultCurrency: context.merchant.defaultCurrency,
        timezone: context.merchant.timezone
      },
      historicalEvidence: safeObject(context.opportunity.evidence)
    });

    return db.transaction(async (tx) => {
      const [{ version }] = await tx.select({ version: count() }).from(strategies)
        .where(eq(strategies.opportunityId, opportunityId));
      const [strategy] = await tx.insert(strategies).values({
        merchantId,
        opportunityId,
        createdByUserId: userId,
        name: `${context.opportunity.title} Strategy`,
        type: strategyType(context.opportunity.type),
        status: 'generated',
        version: Number(version) + 1,
        configuration: generated
      }).returning();
      if (!strategy) throw new AppError(500, 'STRATEGY_CREATION_FAILED', 'Unable to create strategy');
      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: 'strategy',
        entityId: strategy.id,
        action: 'strategy_generated',
        metadata: { opportunityId, version: strategy.version }
      });
      return strategy;
    });
  }
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strategyType(type: string): 'pricing' | 'checkout' | 'payment_method' | 'retention' | 'promotion' | 'other' {
  if (type === 'customer_retry_behavior') return 'retention';
  if (type === 'upi_evening_failure' || type === 'mobile_card_failure') return 'payment_method';
  return 'other';
}

export function getStrategyGenerator(): StrategyGenerator {
  return generator;
}

export type { StrategyOutput };
