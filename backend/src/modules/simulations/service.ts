import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  auditLogs,
  opportunities,
  payments,
  simulations,
  strategies,
} from "../../db/schema.js";
import { AppError } from "../../utils/app-error.js";
import { merchantIdForUser } from "../../utils/merchant-context.js";
export class SimulationService {
  async simulateForUser(userId: string, strategyId: string) {
    const merchantId = await merchantIdForUser(userId);

    const [strategy] = await db
      .select()
      .from(strategies)
      .where(
        and(
          eq(strategies.id, strategyId),
          eq(strategies.merchantId, merchantId),
        ),
      )
      .limit(1);

    if (!strategy) {
      throw new AppError(404, "STRATEGY_NOT_FOUND", "Strategy not found");
    }

    if (!strategy.opportunityId) {
      throw new AppError(
        409,
        "OPPORTUNITY_REQUIRED",
        "A source opportunity is required before simulation",
      );
    }

    const [opportunity] = await db
      .select({
        affectedTransactionCount: opportunities.affectedTransactionCount,
        affectedPaymentValue: opportunities.affectedPaymentValue,
      })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.id, strategy.opportunityId),
          eq(opportunities.merchantId, merchantId),
        ),
      )
      .limit(1);

    if (!opportunity) {
      throw new AppError(
        404,
        "OPPORTUNITY_NOT_FOUND",
        "Source opportunity not found",
      );
    }

    // One simulation per strategy.
    const [existingSimulation] = await db
      .select()
      .from(simulations)
      .where(
        and(
          eq(simulations.strategyId, strategyId),
          eq(simulations.merchantId, merchantId),
        ),
      )
      .orderBy(desc(simulations.createdAt))
      .limit(1);

    if (existingSimulation) {
      return existingSimulation;
    }

    const recoveryRateValue = Number((0.4 + Math.random() * 0.5).toFixed(4));

    const [metrics] = await db
      .select({
        totalTransactions: count(),

        successfulTransactions: sql<number>`
        count(*) filter (
          where ${payments.status} = 'succeeded'
        )
      `,

        currentRevenue: sql<string>`
        coalesce(
          sum(${payments.amount}) filter (
            where ${payments.status} = 'succeeded'
          ),
          0
        )
      `,
      })
      .from(payments)
      .where(eq(payments.merchantId, merchantId));

    const totalTransactions = Number(metrics?.totalTransactions ?? 0);

    const successfulTransactions = Number(metrics?.successfulTransactions ?? 0);

    const affectedTransactions = Number(
      opportunity.affectedTransactionCount ?? 0,
    );

    const affectedPaymentValue = String(
      opportunity.affectedPaymentValue ?? "0",
    );

    const currentSuccessRate = percentage(
      successfulTransactions,
      totalTransactions,
    );

    /*
     * Only the transactions identified by the Opportunity
     * are considered recoverable by this strategy.
     */
    const projectedSuccessRate = percentage(
      successfulTransactions + affectedTransactions * recoveryRateValue,
      totalTransactions,
    );

    /*
     * Recovery is calculated only on the affected payment
     * value from the Opportunity.
     *
     * Example:
     * ₹23,188 × 46.41% = ₹10,762.59
     */
    const potentialRevenueRecovery = subtractMoney(
      multiplyMoney(affectedPaymentValue, recoveryRateValue),
      "0",
    );

    const currentRevenue = metrics?.currentRevenue ?? "0";

    const projectedRevenue = addMoney(currentRevenue, potentialRevenueRecovery);

    const riskLevel =
      recoveryRateValue > 0.75
        ? "high"
        : recoveryRateValue > 0.4
          ? "medium"
          : "low";

    const simulationConfidence =
      totalTransactions >= 100
        ? 95
        : totalTransactions >= 30
          ? 85
          : totalTransactions > 0
            ? 60
            : 0;

    const completedAt = new Date();

    const output = {
      currentSuccessRate,
      projectedSuccessRate,
      currentRevenue,
      projectedRevenue,
      potentialRevenueRecovery,

      totalTransactions,
      affectedTransactions,

      confidence: simulationConfidence,

      assumptions: {
        recoveryRate: recoveryRateValue,
        affectedPaymentValue,
        formula:
          "potential revenue recovery = affected payment value × recovery rate",
      },

      riskLevel,
    };

    return db.transaction(async (tx) => {
      const [simulation] = await tx
        .insert(simulations)
        .values({
          merchantId,
          strategyId,
          status: "completed",

          input: {
            recoveryRate: recoveryRateValue,
            appliedAt: completedAt.toISOString(),
          },

          output,

          projectedRevenue,

          projectedConversionRate: projectedSuccessRate.toFixed(4),

          completedAt,
          createdAt: completedAt,
          updatedAt: completedAt,
        })
        .returning();

      if (!simulation) {
        throw new AppError(
          500,
          "SIMULATION_CREATION_FAILED",
          "Unable to create simulation",
        );
      }

      await tx
        .update(strategies)
        .set({
          status: "simulated",
          updatedAt: completedAt,
        })
        .where(eq(strategies.id, strategyId));

      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: "simulation",
        entityId: simulation.id,
        action: "simulation_created",
        metadata: {
          strategyId,
          status: simulation.status,
        },
      });

      return simulation;
    });
  }

  async listForUser(userId: string, strategyId: string) {
    const merchantId = await merchantIdForUser(userId);
    const [strategy] = await db
      .select({ id: strategies.id })
      .from(strategies)
      .where(
        and(
          eq(strategies.id, strategyId),
          eq(strategies.merchantId, merchantId),
        ),
      )
      .limit(1);
    if (!strategy)
      throw new AppError(404, "STRATEGY_NOT_FOUND", "Strategy not found");
    return db
      .select()
      .from(simulations)
      .where(
        and(
          eq(simulations.strategyId, strategyId),
          eq(simulations.merchantId, merchantId),
        ),
      )
      .orderBy(desc(simulations.createdAt));
  }
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0
    ? 0
    : Number(((numerator / denominator) * 100).toFixed(2));
}

function scaled(value: string | number, scale: number): bigint {
  const normalized = String(value).trim();

  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;

  const [whole, fraction = ""] = unsigned.split(".");

  const result =
    BigInt(whole || "0") * 10n ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, "0").slice(0, scale) || "0");

  return negative ? -result : result;
}

function formatMoney(value: bigint, scale: number): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;

  const divisor = 10n ** BigInt(scale);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(scale, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function addMoney(left: string, right: string): string {
  const scale = 4;

  const leftScaled = scaled(left, scale);
  const rightScaled = scaled(right, scale);

  return formatMoney(leftScaled + rightScaled, scale);
}

function subtractMoney(left: string, right: string): string {
  const scale = 4;

  const leftScaled = scaled(left, scale);
  const rightScaled = scaled(right, scale);

  return formatMoney(leftScaled - rightScaled, scale);
}

function multiplyMoney(amount: string, multiplier: string | number): string {
  const scale = 4;

  const amountScaled = scaled(amount, scale);

  const value =
    (amountScaled * scaled(String(multiplier), scale)) / 10n ** BigInt(scale);

  return formatMoney(value, scale);
}
