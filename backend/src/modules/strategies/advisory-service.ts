import { and, desc, eq } from "drizzle-orm";
import { AdvisoryAgent, type AdvisoryOutput } from "../../ai/advisory-agent.js";
import { GeminiAIProvider } from "../../ai/provider.js";
import { db } from "../../db/client.js";
import {
  advisoryReviews,
  auditLogs,
  merchants,
  opportunities,
  simulations,
  strategies,
} from "../../db/schema.js";
import { AppError } from "../../utils/app-error.js";
import { merchantIdForUser } from "../../utils/merchant-context.js";

const agent = new AdvisoryAgent(new GeminiAIProvider());

export class AdvisoryService {
  async reviewForUser(
    userId: string,
    strategyId: string,
    simulationId: string,
  ) {
    const merchantId = await merchantIdForUser(userId);

    const [context] = await db
      .select({
        merchant: merchants,
        opportunity: opportunities,
        strategy: strategies,
        simulation: simulations,
      })
      .from(strategies)
      .innerJoin(merchants, eq(strategies.merchantId, merchants.id))
      .leftJoin(opportunities, eq(strategies.opportunityId, opportunities.id))
      .leftJoin(
        simulations,
        and(
          eq(simulations.strategyId, strategies.id),
          eq(simulations.id, simulationId),
          eq(simulations.status, "completed"),
        ),
      )
      .where(
        and(
          eq(strategies.id, strategyId),
          eq(strategies.merchantId, merchantId),
        ),
      )
      .limit(1);

    if (!context) {
      throw new AppError(404, "STRATEGY_NOT_FOUND", "Strategy not found");
    }

    if (!context.simulation) {
      throw new AppError(
        409,
        "SIMULATION_REQUIRED",
        "A completed simulation is required before advisory review",
      );
    }

    if (!context.opportunity) {
      throw new AppError(
        409,
        "OPPORTUNITY_REQUIRED",
        "A source opportunity is required before advisory review",
      );
    }

    const generated = await agent.review({
      // merchant: safeObject(context.merchant),
      
      opportunity: safeObject(context.opportunity),

      relevantAnalytics: safeObject(context.opportunity.evidence),

      strategy: safeObject(context.strategy.configuration),

      simulation: safeObject(context.simulation.output),
    });

    const status =
      generated.decision === "APPROVE"
        ? "approved"
        : generated.decision === "REJECT"
          ? "rejected"
          : "needs_review";

    const reviewedAt = new Date();

    return db.transaction(async (tx) => {
      const [review] = await tx
        .insert(advisoryReviews)
        .values({
          merchantId,

          simulationId: context.simulation!.id,

          status,

          recommendation: generated.decision,

          rationale:
            generated.recommendations.join(" ") ||
            "No additional recommendations.",

          riskAssessment: {
            confidence: generated.confidence,
            riskLevel: generated.riskLevel,
            concerns: generated.concerns,
            assumptionIssues: generated.assumptionIssues,
          },

          reviewedAt,
          createdAt: reviewedAt,
          updatedAt: reviewedAt,
        })
        .returning();

      if (!review) {
        throw new AppError(
          500,
          "ADVISORY_REVIEW_CREATION_FAILED",
          "Unable to create advisory review",
        );
      }

      await tx
        .update(strategies)
        .set({
          status: "reviewed",
          updatedAt: reviewedAt,
        })
        .where(eq(strategies.id, strategyId));

      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: "advisory_review",
        entityId: review.id,
        action: "advisory_completed",
        metadata: {
          strategyId,
          decision: generated.decision,
          riskLevel: generated.riskLevel,
        },
      });

      return review;
    });
  }
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getAdvisoryAgent(): AdvisoryAgent {
  return agent;
}

export type { AdvisoryOutput };
