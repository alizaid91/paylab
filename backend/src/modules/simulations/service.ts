import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { auditLogs, payments, simulations, strategies } from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import { merchantIdForUser } from '../../utils/merchant-context.js';
import type { SimulationInput } from '../strategies/validation.js';

export class SimulationService {
  async simulateForUser(userId: string, strategyId: string, input: SimulationInput) {
    const merchantId = await merchantIdForUser(userId);
    const [strategy] = await db.select().from(strategies).where(and(
      eq(strategies.id, strategyId),
      eq(strategies.merchantId, merchantId)
    )).limit(1);
    if (!strategy) throw new AppError(404, 'STRATEGY_NOT_FOUND', 'Strategy not found');

    const recoveryRate = input.recoveryRate.toFixed(4);
    const [metrics] = await db.select({
      totalTransactions: count(),
      successfulTransactions: sql<number>`count(*) filter (where ${payments.status} = 'succeeded')`,
      failedTransactions: sql<number>`count(*) filter (where ${payments.status} = 'failed')`,
      currentRevenue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'succeeded'), 0)`,
      failedPaymentValue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'failed'), 0)`
    }).from(payments).where(eq(payments.merchantId, merchantId));

    const totalTransactions = Number(metrics?.totalTransactions ?? 0);
    const successfulTransactions = Number(metrics?.successfulTransactions ?? 0);
    const failedTransactions = Number(metrics?.failedTransactions ?? 0);
    const currentSuccessRate = percentage(successfulTransactions, totalTransactions);
    const [projected] = await db.select({
      projectedRevenue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'succeeded'), 0) +
        coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'failed'), 0) * ${recoveryRate}::numeric`
    }).from(payments).where(eq(payments.merchantId, merchantId));
    const projectedSuccessRate = percentage(successfulTransactions + failedTransactions * input.recoveryRate, totalTransactions);
    const currentRevenue = metrics?.currentRevenue ?? '0';
    const projectedRevenue = projected?.projectedRevenue ?? currentRevenue;
    const potentialRevenueRecovery = subtractMoney(projectedRevenue, currentRevenue);
    const riskLevel = input.recoveryRate > 0.75 ? 'high' : input.recoveryRate > 0.4 ? 'medium' : 'low';
    const simulationConfidence = totalTransactions >= 100 ? 95 : totalTransactions >= 30 ? 85 : totalTransactions > 0 ? 60 : 0;
    const completedAt = new Date();
    const output = {
      currentSuccessRate,
      projectedSuccessRate,
      currentRevenue,
      projectedRevenue,
      potentialRevenueRecovery,
      totalTransactions,
      affectedTransactions: failedTransactions,
      confidence: simulationConfidence,
      assumptions: {
        recoveryRate: input.recoveryRate,
        formula: 'projected revenue = current successful revenue + failed payment value × recovery rate'
      },
      riskLevel
    };

    return db.transaction(async (tx) => {
      const [simulation] = await tx.insert(simulations).values({
        merchantId,
        strategyId,
        status: 'completed',
        input: { recoveryRate: input.recoveryRate, appliedAt: completedAt.toISOString() },
        output,
        projectedRevenue,
        projectedConversionRate: projectedSuccessRate.toFixed(4),
        completedAt,
        createdAt: completedAt,
        updatedAt: completedAt
      }).returning();
      if (!simulation) throw new AppError(500, 'SIMULATION_CREATION_FAILED', 'Unable to create simulation');
      await tx.update(strategies).set({ status: 'simulated', updatedAt: completedAt }).where(eq(strategies.id, strategyId));
      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: 'simulation',
        entityId: simulation.id,
        action: 'simulation_created',
        metadata: { strategyId, status: simulation.status }
      });
      return simulation;
    });
  }

  async listForUser(userId: string, strategyId: string) {
    const merchantId = await merchantIdForUser(userId);
    const [strategy] = await db.select({ id: strategies.id }).from(strategies).where(and(
      eq(strategies.id, strategyId),
      eq(strategies.merchantId, merchantId)
    )).limit(1);
    if (!strategy) throw new AppError(404, 'STRATEGY_NOT_FOUND', 'Strategy not found');
    return db.select().from(simulations).where(and(
      eq(simulations.strategyId, strategyId),
      eq(simulations.merchantId, merchantId)
    )).orderBy(desc(simulations.createdAt));
  }
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2));
}

function subtractMoney(left: string, right: string): string {
  const scale = 4;
  const leftScaled = scaled(left, scale);
  const rightScaled = scaled(right, scale);
  const value = leftScaled - rightScaled;
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 10000n}.${(absolute % 10000n).toString().padStart(4, '0')}`;
}

function scaled(value: string, scale: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole || '0') * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0').slice(0, scale) || '0');
}
