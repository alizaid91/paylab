import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { advisoryReviews, auditLogs, executions, executionResults, policyResults, simulations, strategies } from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import { merchantIdForUser } from '../../utils/merchant-context.js';

export class ExecutionService {
  async approveForUser(userId: string, strategyId: string) {
    const merchantId = await merchantIdForUser(userId);
    return db.transaction(async (tx) => {
      const [strategy] = await tx.select().from(strategies).where(and(
        eq(strategies.id, strategyId),
        eq(strategies.merchantId, merchantId)
      )).limit(1);
      if (!strategy) throw new AppError(404, 'STRATEGY_NOT_FOUND', 'Strategy not found');
      if (strategy.status !== 'policy_approved') {
        throw new AppError(409, 'STRATEGY_NOT_APPROVABLE', 'Strategy must pass policy checks before merchant approval');
      }
      const [simulation] = await tx.select().from(simulations).where(and(
        eq(simulations.strategyId, strategyId),
        eq(simulations.merchantId, merchantId),
        eq(simulations.status, 'completed')
      )).orderBy(desc(simulations.createdAt)).limit(1);
      if (!simulation) throw new AppError(409, 'SIMULATION_REQUIRED', 'A completed simulation is required');
      const [advisory] = await tx.select().from(advisoryReviews).where(and(
        eq(advisoryReviews.simulationId, simulation.id),
        eq(advisoryReviews.merchantId, merchantId)
      )).orderBy(desc(advisoryReviews.createdAt)).limit(1);
      if (!advisory) throw new AppError(409, 'ADVISORY_REVIEW_REQUIRED', 'An advisory review is required');
      const [policy] = await tx.select().from(policyResults).where(and(
        eq(policyResults.simulationId, simulation.id),
        eq(policyResults.merchantId, merchantId),
        eq(policyResults.status, 'passed')
      )).orderBy(desc(policyResults.evaluatedAt)).limit(1);
      if (!policy) throw new AppError(409, 'POLICY_APPROVAL_REQUIRED', 'A passed policy check is required');

      const approvedAt = new Date();
      const [approved] = await tx.update(strategies).set({
        status: 'merchant_approved',
        approvedByUserId: userId,
        updatedAt: approvedAt
      }).where(and(eq(strategies.id, strategyId), eq(strategies.status, 'policy_approved'))).returning();
      if (!approved) throw new AppError(409, 'STRATEGY_NOT_APPROVABLE', 'Strategy approval state changed; retry the request');
      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: 'strategy',
        entityId: strategyId,
        action: 'strategy_approved',
        metadata: { simulationId: simulation.id, policyResultId: policy.id, advisoryReviewId: advisory.id }
      });
      return approved;
    });
  }

  async executeForUser(userId: string, strategyId: string) {
    const merchantId = await merchantIdForUser(userId);
    return db.transaction(async (tx) => {
      const [strategy] = await tx.select().from(strategies).where(and(
        eq(strategies.id, strategyId),
        eq(strategies.merchantId, merchantId)
      )).limit(1);
      if (!strategy) throw new AppError(404, 'STRATEGY_NOT_FOUND', 'Strategy not found');
      if (strategy.status !== 'merchant_approved' || !strategy.approvedByUserId) {
        throw new AppError(409, 'MERCHANT_APPROVAL_REQUIRED', 'Merchant approval is required before execution');
      }
      const [existing] = await tx.select({ id: executions.id }).from(executions)
        .where(and(eq(executions.strategyId, strategyId), eq(executions.merchantId, merchantId))).limit(1);
      if (existing) throw new AppError(409, 'DUPLICATE_EXECUTION', 'This strategy has already been executed');

      const [simulation] = await tx.select().from(simulations).where(and(
        eq(simulations.strategyId, strategyId),
        eq(simulations.merchantId, merchantId),
        eq(simulations.status, 'completed')
      )).orderBy(desc(simulations.createdAt)).limit(1);
      if (!simulation) throw new AppError(409, 'SIMULATION_REQUIRED', 'A completed simulation is required');
      const [policy] = await tx.select().from(policyResults).where(and(
        eq(policyResults.simulationId, simulation.id),
        eq(policyResults.merchantId, merchantId),
        eq(policyResults.status, 'passed')
      )).orderBy(desc(policyResults.evaluatedAt)).limit(1);
      if (!policy) throw new AppError(409, 'POLICY_APPROVAL_REQUIRED', 'A passed policy check is required');

      const output = objectValue(simulation.output);
      const expectedRecovery = stringValue(output.potentialRevenueRecovery) ?? '0';
      const actualRecovery = halfOfNinetyPercent(expectedRecovery);
      const startedAt = new Date();
      const [execution] = await tx.insert(executions).values({
        merchantId,
        strategyId,
        opportunityId: strategy.opportunityId,
        policyResultId: policy.id,
        approvedByUserId: strategy.approvedByUserId,
        status: 'running',
        affectedTransactionCount: numberValue(output.affectedTransactions),
        expectedRecovery,
        startedAt,
        createdAt: startedAt,
        updatedAt: startedAt
      }).returning();
      if (!execution) throw new AppError(500, 'EXECUTION_CREATION_FAILED', 'Unable to create execution');
      await tx.update(strategies).set({ status: 'executing', updatedAt: startedAt }).where(eq(strategies.id, strategyId));
      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: 'execution',
        entityId: execution.id,
        action: 'execution_started',
        metadata: { strategyId, expectedRecovery, simulated: true }
      });

      const completedAt = new Date();
      const [result] = await tx.insert(executionResults).values({
        merchantId,
        executionId: execution.id,
        status: 'succeeded',
        resultType: 'simulated_recovery',
        actualRevenue: actualRecovery,
        actualRecovery,
        details: { simulated: true, recoveryRateApplied: '0.90', expectedRecovery },
        createdAt: completedAt,
        updatedAt: completedAt
      }).returning();
      if (!result) throw new AppError(500, 'EXECUTION_RESULT_FAILED', 'Unable to create execution result');
      const [completed] = await tx.update(executions).set({
        status: 'completed',
        completedAt,
        updatedAt: completedAt
      }).where(eq(executions.id, execution.id)).returning();
      await tx.update(strategies).set({ status: 'completed', updatedAt: completedAt }).where(eq(strategies.id, strategyId));
      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: 'execution',
        entityId: execution.id,
        action: 'execution_completed',
        metadata: { resultId: result.id, actualRecovery, simulated: true }
      });
      return { execution: completed, result };
    });
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function numberValue(value: unknown): number {
  return Number(value ?? 0);
}
function halfOfNinetyPercent(value: string): string {
  const scaled = moneyToScaled(value);
  const result = (scaled * 9n) / 10n;
  return `${result / 10000n}.${(result % 10000n).toString().padStart(4, '0')}`;
}
function moneyToScaled(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole || '0') * 10000n + BigInt(fraction.padEnd(4, '0').slice(0, 4) || '0');
}
