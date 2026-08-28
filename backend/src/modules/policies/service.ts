import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  advisoryReviews,
  auditLogs,
  opportunities,
  policies,
  policyResults,
  simulations,
  strategies,
} from "../../db/schema.js";
import { AppError } from "../../utils/app-error.js";
import { merchantIdForUser } from "../../utils/merchant-context.js";
import {
  policyRulesSchema,
  type PolicyCheckInput,
  type PolicyRules,
} from "./validation.js";

const defaultRules: PolicyRules = {
  maxAffectedTransactionPercentage: 10,
  maxRevenueExposurePercentage: 25,
  allowedPaymentMethods: ["upi", "card", "net_banking"],
  allowedExecutionHours: { start: 0, end: 23 },
  maxDailyExecutionAmount: "100000.0000",
  minimumStrategyConfidence: 60,
  minimumSimulationConfidence: 60,
};

export class PolicyService {
  async getForUser(userId: string) {
    const merchantId = await merchantIdForUser(userId);
    return this.getPolicy(merchantId);
  }

  async updateForUser(userId: string, rules: PolicyRules) {
    const merchantId = await merchantIdForUser(userId);
    const policy = await this.getPolicy(merchantId);
    const [updated] = await db.update(policies).set({ rules, updatedAt: new Date() })
      .where(and(eq(policies.id, policy.id), eq(policies.merchantId, merchantId))).returning();
    if (!updated) throw new AppError(404, 'POLICY_NOT_FOUND', 'Policy not found');
    return updated;
  }

  async checkForUser(
    userId: string,
    strategyId: string,
    input: PolicyCheckInput,
  ) {
    const merchantId = await merchantIdForUser(userId);
    const [context] = await db
      .select({
        strategy: strategies,
        opportunity: opportunities,
        simulation: simulations,
        advisory: advisoryReviews,
      })
      .from(strategies)
      .leftJoin(opportunities, eq(strategies.opportunityId, opportunities.id))
      .leftJoin(
        simulations,
        and(
          eq(simulations.strategyId, strategies.id),
          eq(simulations.status, "completed"),
        ),
      )
      .innerJoin(
        advisoryReviews,
        and(
          eq(advisoryReviews.simulationId, simulations.id),
          eq(advisoryReviews.merchantId, merchantId),
        ),
      )
      .where(
        and(
          eq(strategies.id, strategyId),
          eq(strategies.merchantId, merchantId),
        ),
      )
      .orderBy(desc(simulations.createdAt), desc(advisoryReviews.createdAt))
      .limit(1);
    if (!context)
      throw new AppError(404, "STRATEGY_NOT_FOUND", "Strategy not found");
    if (!context.simulation)
      throw new AppError(
        409,
        "SIMULATION_REQUIRED",
        "A completed simulation is required before policy check",
      );
    if (!context.advisory)
      throw new AppError(
        409,
        "ADVISORY_REVIEW_REQUIRED",
        "An advisory review is required before policy check",
      );

    const policy = await this.getPolicy(merchantId, input.policyId);
    const rules = policyRulesSchema.parse(policy.rules);
    const simulationOutput = objectValue(context.simulation.output);
    const strategyOutput = objectValue(context.strategy.configuration);
    const totalTransactions = numberValue(simulationOutput.totalTransactions);
    const affectedTransactions = numberValue(
      simulationOutput.affectedTransactions,
    );
    const affectedPercentage =
      totalTransactions === 0
        ? 0
        : (affectedTransactions / totalTransactions) * 100;
    const exposurePercentage = percentageOf(
      simulationOutput.potentialRevenueRecovery,
      simulationOutput.currentRevenue,
    );
    const paymentMethod =
      typeof context.opportunity?.evidence === "object" &&
      context.opportunity.evidence !== null
        ? stringValue(
            (context.opportunity.evidence as Record<string, unknown>)
              .paymentMethod,
          )
        : undefined;
    const strategyConfidence = numberValue(strategyOutput.confidence);
    const simulationConfidence = numberValue(simulationOutput.confidence);
    const executionAmount =
      stringValue(simulationOutput.potentialRevenueRecovery) || "0";
    const failedRules: Array<Record<string, unknown>> = [];
    const warnings: Array<Record<string, unknown>> = [];
    const evaluatedValues = {
      affectedTransactionPercentage: round(affectedPercentage),
      revenueExposurePercentage: round(exposurePercentage),
      paymentMethod: paymentMethod ?? "all",
      executionHour: input.executionHour,
      dailyExecutionAmount: executionAmount,
      strategyConfidence,
      simulationConfidence,
      advisoryDecision: context.advisory.recommendation,
    };

    if (affectedPercentage > rules.maxAffectedTransactionPercentage)
      failedRules.push({
        rule: "maxAffectedTransactionPercentage",
        actual: round(affectedPercentage),
        limit: rules.maxAffectedTransactionPercentage,
      });
    if (exposurePercentage > rules.maxRevenueExposurePercentage)
      failedRules.push({
        rule: "maxRevenueExposurePercentage",
        actual: round(exposurePercentage),
        limit: rules.maxRevenueExposurePercentage,
      });
    if (
      paymentMethod &&
      !rules.allowedPaymentMethods.includes(
        paymentMethod as "upi" | "card" | "net_banking",
      )
    )
      failedRules.push({
        rule: "allowedPaymentMethods",
        actual: paymentMethod,
        allowed: rules.allowedPaymentMethods,
      });
    if (
      input.executionHour < rules.allowedExecutionHours.start ||
      input.executionHour > rules.allowedExecutionHours.end
    )
      failedRules.push({
        rule: "allowedExecutionHours",
        actual: input.executionHour,
        allowed: rules.allowedExecutionHours,
      });
    if (compareMoney(executionAmount, rules.maxDailyExecutionAmount) > 0)
      failedRules.push({
        rule: "maxDailyExecutionAmount",
        actual: executionAmount,
        limit: rules.maxDailyExecutionAmount,
      });
    if (strategyConfidence < rules.minimumStrategyConfidence)
      failedRules.push({
        rule: "minimumStrategyConfidence",
        actual: strategyConfidence,
        limit: rules.minimumStrategyConfidence,
      });
    if (simulationConfidence < rules.minimumSimulationConfidence)
      failedRules.push({
        rule: "minimumSimulationConfidence",
        actual: simulationConfidence,
        limit: rules.minimumSimulationConfidence,
      });
    if (
      context.advisory.status !== "approved" ||
      context.advisory.recommendation !== "APPROVE"
    ) {
      failedRules.push({
        rule: "advisoryApproval",
        actual: context.advisory.recommendation,
        status: context.advisory.status,
        required: "APPROVE",
      });
    }
    if (context.strategy.status !== "approved")
      warnings.push({
        code: "MERCHANT_APPROVAL_REQUIRED",
        message: "Merchant approval is still required before execution.",
      });

    const evaluatedAt = new Date();
    const result = await db.transaction(async (tx) => {
      const [policyResult] = await tx
        .insert(policyResults)
        .values({
          merchantId,
          policyId: policy.id,
          advisoryReviewId: context.advisory!.id,
          simulationId: context.simulation!.id,
          status: failedRules.length === 0 ? "passed" : "failed",
          decision: failedRules.length === 0 ? "pass" : "fail",
          reasons: failedRules,
          evaluatedAt,
          createdAt: evaluatedAt,
          updatedAt: evaluatedAt,
        })
        .returning();
      if (!policyResult)
        throw new AppError(
          500,
          "POLICY_RESULT_CREATION_FAILED",
          "Unable to store policy result",
        );
      if (failedRules.length === 0) {
        await tx
          .update(strategies)
          .set({ status: "policy_approved", updatedAt: evaluatedAt })
          .where(eq(strategies.id, strategyId));
      } else {
        await tx
          .update(strategies)
          .set({ status: "failed", updatedAt: evaluatedAt })
          .where(eq(strategies.id, strategyId));
      }
      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: "policy",
        entityId: policyResult.id,
        action: "policy_checked",
        metadata: {
          strategyId,
          passed: failedRules.length === 0,
          failedRuleCount: failedRules.length,
        },
      });
      return policyResult;
    });
    return {
      passed: failedRules.length === 0,
      failedRules,
      warnings,
      evaluatedValues,
      evaluatedAt,
      policyResult: result,
    };
  }

  private async getPolicy(merchantId: string, policyId?: string) {
    const [policy] = await db
      .select()
      .from(policies)
      .where(
        and(
          eq(policies.merchantId, merchantId),
          policyId ? eq(policies.id, policyId) : eq(policies.status, "active"),
        ),
      )
      .limit(1);
    if (policy) return policy;
    if (policyId)
      throw new AppError(404, "POLICY_NOT_FOUND", "Policy not found");
    const [created] = await db
      .insert(policies)
      .values({
        merchantId,
        name: "PAYLAB Default Safety Policy",
        status: "active",
        rules: defaultRules,
      })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const [existing] = await db
      .select()
      .from(policies)
      .where(
        and(eq(policies.merchantId, merchantId), eq(policies.status, "active")),
      )
      .limit(1);
    if (!existing)
      throw new AppError(
        500,
        "POLICY_UNAVAILABLE",
        "No active policy is available",
      );
    return existing;
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}
function round(value: number): number {
  return Number(value.toFixed(2));
}
function percentageOf(value: unknown, total: unknown): number {
  const denominator = numberValue(total);
  return denominator === 0 ? 0 : (numberValue(value) / denominator) * 100;
}
function compareMoney(left: string, right: string): number {
  const leftScaled =
    BigInt(left.split(".")[0] || "0") * 10000n +
    BigInt((left.split(".")[1] ?? "").padEnd(4, "0").slice(0, 4) || "0");
  const rightScaled =
    BigInt(right.split(".")[0] || "0") * 10000n +
    BigInt((right.split(".")[1] ?? "").padEnd(4, "0").slice(0, 4) || "0");
  return leftScaled === rightScaled ? 0 : leftScaled > rightScaled ? 1 : -1;
}
