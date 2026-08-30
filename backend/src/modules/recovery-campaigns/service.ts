import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  auditLogs,
  paymentAttempts,
  payments,
  policies,
  recoveryCampaigns,
  recoveryExecutions,
  simulations,
  strategies,
  opportunities,
} from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import { merchantIdForUser } from '../../utils/merchant-context.js';
import { MockPaymentProvider, RecoveryService } from './provider.js';

const recoveryService = new RecoveryService(new MockPaymentProvider());

export class RecoveryCampaignService {
  async createForUser(userId: string, strategyId: string) {
    const merchantId = await merchantIdForUser(userId);

    const [strategy] = await db
      .select()
      .from(strategies)
      .where(and(eq(strategies.id, strategyId), eq(strategies.merchantId, merchantId)))
      .limit(1);

    if (!strategy) {
      throw new AppError(404, 'STRATEGY_NOT_FOUND', 'Strategy not found');
    }

    if (!strategy.opportunityId) {
      throw new AppError(409, 'OPPORTUNITY_REQUIRED', 'A source opportunity is required before creating a recovery campaign');
    }

    if (strategy.status !== 'merchant_approved' || !strategy.approvedByUserId) {
      throw new AppError(
        409,
        'MERCHANT_APPROVAL_REQUIRED',
        'Merchant approval is required before creating a recovery campaign',
      );
    }

    const [opportunity] = await db
      .select({
        affectedTransactionCount: opportunities.affectedTransactionCount,
        affectedPaymentValue: opportunities.affectedPaymentValue,
      })
      .from(opportunities)
      .where(and(eq(opportunities.id, strategy.opportunityId), eq(opportunities.merchantId, merchantId)))
      .limit(1);

    if (!opportunity) {
      throw new AppError(404, 'OPPORTUNITY_NOT_FOUND', 'Source opportunity not found');
    }

    const [existing] = await db
      .select({ id: recoveryCampaigns.id })
      .from(recoveryCampaigns)
      .where(and(eq(recoveryCampaigns.strategyId, strategyId), eq(recoveryCampaigns.merchantId, merchantId)))
      .limit(1);

    if (existing) {
      throw new AppError(409, 'DUPLICATE_RECOVERY_CAMPAIGN', 'A recovery campaign already exists for this strategy');
    }

    const [simulation] = await db
      .select()
      .from(simulations)
      .where(and(eq(simulations.strategyId, strategyId), eq(simulations.merchantId, merchantId), eq(simulations.status, 'completed')))
      .orderBy(desc(simulations.createdAt))
      .limit(1);

    const approvedAt = new Date();
    const strategySnapshot = objectValue(strategy.configuration);

    const [campaign] = await db
      .insert(recoveryCampaigns)
      .values({
        merchantId,
        opportunityId: strategy.opportunityId,
        strategyId,
        status: 'approved',
        strategySnapshot,
        targetCount: numberValue(opportunity.affectedTransactionCount),
        eligibleCount: 0,
        processedCount: 0,
        successfulCount: 0,
        failedCount: 0,
        skippedCount: 0,
        revenueAtRisk: stringValue(opportunity.affectedPaymentValue) ?? '0',
        expectedRecoveryAmount: stringValue(simulation ? objectValue(simulation.output).potentialRevenueRecovery : undefined) ?? '0',
        recoveredAmount: '0',
        approvedAt,
        createdAt: approvedAt,
        updatedAt: approvedAt,
      })
      .returning();

    if (!campaign) {
      throw new AppError(500, 'RECOVERY_CAMPAIGN_CREATION_FAILED', 'Unable to create recovery campaign');
    }

    await db.insert(auditLogs).values({
      merchantId,
      actorUserId: userId,
      entityType: 'recovery_campaign',
      entityId: campaign.id,
      action: 'CAMPAIGN_CREATED',
      metadata: {
        strategyId,
        opportunityId: strategy.opportunityId,
        targetCount: campaign.targetCount,
        revenueAtRisk: campaign.revenueAtRisk,
      },
    });

    return campaign;
  }

  async getByIdForUser(userId: string, campaignId: string) {
    const merchantId = await merchantIdForUser(userId);
    const [campaign] = await db
      .select()
      .from(recoveryCampaigns)
      .where(and(eq(recoveryCampaigns.id, campaignId), eq(recoveryCampaigns.merchantId, merchantId)))
      .limit(1);

    if (!campaign) {
      throw new AppError(404, 'RECOVERY_CAMPAIGN_NOT_FOUND', 'Recovery campaign not found');
    }

    return campaign;
  }

  async listForUser(userId: string) {
    const merchantId = await merchantIdForUser(userId);
    return db
      .select()
      .from(recoveryCampaigns)
      .where(eq(recoveryCampaigns.merchantId, merchantId))
      .orderBy(desc(recoveryCampaigns.updatedAt));
  }

  async startForUser(userId: string, campaignId: string) {
    const merchantId = await merchantIdForUser(userId);
    const [campaign] = await db
      .select()
      .from(recoveryCampaigns)
      .where(and(eq(recoveryCampaigns.id, campaignId), eq(recoveryCampaigns.merchantId, merchantId)))
      .limit(1);

    if (!campaign) {
      throw new AppError(404, 'RECOVERY_CAMPAIGN_NOT_FOUND', 'Recovery campaign not found');
    }

    console.log('Starting recovery campaign', { campaignId, merchantId, userId });

    assertAllowedTransition(campaign.status, 'queued', 'approved');

    const startedAt = new Date();
    const campaignResult = await db.transaction(async (tx) => {
      const [activeCampaign] = await tx
        .select()
        .from(recoveryCampaigns)
        .where(and(eq(recoveryCampaigns.id, campaignId), eq(recoveryCampaigns.merchantId, merchantId)))
        .for('update')
        .limit(1);

      if (!activeCampaign) {
        throw new AppError(404, 'RECOVERY_CAMPAIGN_NOT_FOUND', 'Recovery campaign not found');
      }

      if (activeCampaign.status !== 'approved') {
        throw new AppError(409, 'INVALID_CAMPAIGN_STATE', 'Campaign must be in approved state to start');
      }

      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: 'recovery_campaign',
        entityId: campaignId,
        action: 'CAMPAIGN_STARTED',
        metadata: {
          status: 'queued',
          startedAt: startedAt.toISOString(),
        },
      });

      const [queuedCampaign] = await tx
        .update(recoveryCampaigns)
        .set({ status: 'queued', startedAt, updatedAt: startedAt })
        .where(and(
          eq(recoveryCampaigns.id, campaignId),
          eq(recoveryCampaigns.merchantId, merchantId),
          eq(recoveryCampaigns.status, 'approved'),
        ))
        .returning();

      await tx
        .update(strategies)
        .set({ status: 'executing', updatedAt: startedAt })
        .where(and(
          eq(strategies.id, activeCampaign.strategyId),
          eq(strategies.merchantId, merchantId),
        ));

      return queuedCampaign ?? activeCampaign;
    });

    void this.processCampaign({
      campaignId,
      merchantId,
      userId,
    });

    return campaignResult;
  }

  private async processCampaign({
    campaignId,
    merchantId,
    userId,
  }: {
    campaignId: string;
    merchantId: string;
    userId: string;
  }) {
    try {
      const campaign = await this.getByIdForMerchant(merchantId, campaignId);
      if (campaign.status !== 'queued') return;

      const [strategy] = await db
        .select()
        .from(strategies)
        .where(and(eq(strategies.id, campaign.strategyId), eq(strategies.merchantId, merchantId)))
        .limit(1);
      if (!strategy) throw new AppError(404, 'STRATEGY_NOT_FOUND', 'Strategy not found');

      const [policy] = await db
        .select({ rules: policies.rules })
        .from(policies)
        .where(and(eq(policies.merchantId, merchantId), eq(policies.status, 'active')))
        .orderBy(desc(policies.createdAt))
        .limit(1);

      const { eligible: eligiblePayments, skipped } = await this.resolveEligiblePayments(
        merchantId,
        campaign,
        strategy,
        policy?.rules,
      );
      const targetLimit = Math.min(campaign.targetCount || eligiblePayments.length, eligiblePayments.length);
      const existingExecutions = await db
        .select({
          paymentId: recoveryExecutions.paymentId,
          status: recoveryExecutions.status,
          attemptNumber: recoveryExecutions.attemptNumber,
        })
        .from(recoveryExecutions)
        .where(and(
          eq(recoveryExecutions.merchantId, merchantId),
          eq(recoveryExecutions.campaignId, campaignId),
        ));
      const maxAttempts = getMaxAttempts(strategy.configuration);
      const completedPaymentIds = new Set(
        existingExecutions
          .filter((execution) =>
            execution.status === 'success' ||
            (execution.status === 'failed' && execution.attemptNumber >= maxAttempts),
          )
          .map((execution) => execution.paymentId),
      );
      const selectedPayments = eligiblePayments
        .filter((payment) => !completedPaymentIds.has(payment.id))
        .slice(0, targetLimit);
      const existingSkippedPaymentIds = new Set(
        existingExecutions
          .filter((execution) => execution.status === 'skipped')
          .map((execution) => execution.paymentId),
      );
      const newSkipped = skipped.filter((payment) => !existingSkippedPaymentIds.has(payment.paymentId));

      const preparedAt = new Date();
      await db.transaction(async (tx) => {
        const skipRows = newSkipped.map((skippedPayment) => ({
          merchantId,
          campaignId,
          paymentId: skippedPayment.paymentId,
          strategyId: strategy.id,
          status: 'skipped' as const,
          attemptNumber: 0,
          idempotencyKey: `${campaignId}_${skippedPayment.paymentId}_skipped`,
          amount: skippedPayment.amount,
          recoveredAmount: '0',
          skipReason: skippedPayment.reason,
          startedAt: preparedAt,
          completedAt: preparedAt,
          createdAt: preparedAt,
          updatedAt: preparedAt,
        }));
        if (skipRows.length > 0) {
          await tx.insert(recoveryExecutions).values(skipRows).onConflictDoNothing();
          await tx.insert(auditLogs).values(newSkipped.map((skippedPayment) => ({
            merchantId,
            actorUserId: userId,
            entityType: 'recovery_campaign' as const,
            entityId: campaignId,
            action: 'PAYMENT_SKIPPED',
            metadata: {
              paymentId: skippedPayment.paymentId,
              strategyId: strategy.id,
              reason: skippedPayment.reason,
              amount: skippedPayment.amount,
            },
          })));
        }

        await tx
          .update(recoveryCampaigns)
          .set({
            status: selectedPayments.length > 0 ? 'running' : 'completed',
            eligibleCount: Math.max(campaign.eligibleCount, selectedPayments.length),
            skippedCount: campaign.skippedCount + newSkipped.length,
            completedAt: selectedPayments.length > 0 ? null : preparedAt,
            updatedAt: preparedAt,
          })
          .where(and(
            eq(recoveryCampaigns.id, campaignId),
            eq(recoveryCampaigns.merchantId, merchantId),
            eq(recoveryCampaigns.status, 'queued'),
          ));
      });

      if (selectedPayments.length === 0) {
        await db
          .update(strategies)
          .set({ status: 'completed', updatedAt: preparedAt })
          .where(and(eq(strategies.id, strategy.id), eq(strategies.merchantId, merchantId)));
        await db.insert(auditLogs).values({
          merchantId,
          actorUserId: userId,
          entityType: 'recovery_campaign',
          entityId: campaignId,
          action: 'CAMPAIGN_COMPLETED',
          metadata: { eligibleCount: campaign.eligibleCount, skippedCount: campaign.skippedCount + newSkipped.length },
        });
        return;
      }

      let processedCount = campaign.processedCount;
      let successfulCount = campaign.successfulCount;
      let failedCount = campaign.failedCount;
      let skippedCount = campaign.skippedCount + newSkipped.length;
      let recoveredAmount = campaign.recoveredAmount;

      for (const payment of selectedPayments) {
        const current = await this.getByIdForMerchant(merchantId, campaignId);
        if (current.status !== 'running') return;

        const flowResult = await db.transaction(async (tx) =>
          this.processPaymentAttemptLoop({
            tx,
            campaign,
            merchantId,
            userId,
            strategy,
            payment,
            maxAttempts: getMaxAttempts(strategy.configuration),
            policyRules: safePolicyRules(policy?.rules),
          }),
        );

        if (flowResult.status === 'skipped') {
          skippedCount += 1;
        } else {
          processedCount += 1;
          if (flowResult.status === 'success') {
            successfulCount += 1;
            recoveredAmount = addMoney(recoveredAmount, flowResult.recoveredAmount ?? '0');
          } else {
            failedCount += 1;
          }
        }

        const recoveryRate = processedCount > 0 ? successfulCount / processedCount : 0;
        const stoppingReason = processedCount >= 10 && recoveryRate < 0.4
          ? 'MINIMUM_RECOVERY_RATE_VIOLATED'
          : undefined;
        const status = stoppingReason ? 'stopped_by_rule' : 'running';
        const updatedAt = new Date();

        const progressSaved = await db.transaction(async (tx) => {
          const [updatedCampaign] = await tx
            .update(recoveryCampaigns)
            .set({
              status,
              processedCount,
              successfulCount,
              failedCount,
              skippedCount,
              recoveredAmount,
              stoppingReason,
              updatedAt,
            })
            .where(and(
              eq(recoveryCampaigns.id, campaignId),
              eq(recoveryCampaigns.merchantId, merchantId),
              eq(recoveryCampaigns.status, 'running'),
            ))
            .returning({ id: recoveryCampaigns.id });

          if (!updatedCampaign) return false;

          if (stoppingReason) {
            await tx.insert(auditLogs).values({
              merchantId,
              actorUserId: userId,
              entityType: 'recovery_campaign',
              entityId: campaignId,
              action: 'STOPPING_RULE_TRIGGERED',
              metadata: { reason: stoppingReason, processedCount, successfulCount, failedCount, skippedCount },
            });
            await tx
              .update(strategies)
              .set({ status: 'completed', updatedAt })
              .where(and(eq(strategies.id, strategy.id), eq(strategies.merchantId, merchantId)));
          }
          return true;
        });

        if (!progressSaved || stoppingReason) return;
      }

      const completedAt = new Date();
      await db.transaction(async (tx) => {
        const [completedCampaign] = await tx
          .update(recoveryCampaigns)
          .set({
            status: 'completed',
            completedAt,
            updatedAt: completedAt,
            processedCount,
            successfulCount,
            failedCount,
            skippedCount,
            recoveredAmount,
          })
          .where(and(
            eq(recoveryCampaigns.id, campaignId),
            eq(recoveryCampaigns.merchantId, merchantId),
            eq(recoveryCampaigns.status, 'running'),
          ))
          .returning({ id: recoveryCampaigns.id });

        if (completedCampaign) {
          await tx
            .update(strategies)
            .set({ status: 'completed', updatedAt: completedAt })
            .where(and(eq(strategies.id, strategy.id), eq(strategies.merchantId, merchantId)));
          await tx.insert(auditLogs).values({
            merchantId,
            actorUserId: userId,
            entityType: 'recovery_campaign',
            entityId: campaignId,
            action: 'CAMPAIGN_COMPLETED',
            metadata: { processedCount, successfulCount, failedCount, skippedCount, recoveredAmount },
          });
        }
      });
    } catch (error) {
      const current = await this.getByIdForMerchant(merchantId, campaignId).catch(() => null);
      if (current?.status === 'cancelled') return;
      const failedAt = new Date();
      await db
        .update(recoveryCampaigns)
        .set({ status: 'failed', stoppingReason: 'EXECUTION_ENGINE_ERROR', completedAt: failedAt, updatedAt: failedAt })
        .where(and(eq(recoveryCampaigns.id, campaignId), eq(recoveryCampaigns.merchantId, merchantId)));
      await db.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: 'recovery_campaign',
        entityId: campaignId,
        action: 'CAMPAIGN_STOPPED',
        metadata: { reason: 'EXECUTION_ENGINE_ERROR', error: error instanceof Error ? error.message : 'Unknown execution error' },
      });
    }
  }

  private async getByIdForMerchant(merchantId: string, campaignId: string) {
    const [campaign] = await db
      .select()
      .from(recoveryCampaigns)
      .where(and(eq(recoveryCampaigns.id, campaignId), eq(recoveryCampaigns.merchantId, merchantId)))
      .limit(1);
    if (!campaign) throw new AppError(404, 'RECOVERY_CAMPAIGN_NOT_FOUND', 'Recovery campaign not found');
    return campaign;
  }

  async stopForUser(userId: string, campaignId: string, reason = 'MERCHANT_CANCELLATION') {
    const merchantId = await merchantIdForUser(userId);
    const [campaign] = await db
      .select()
      .from(recoveryCampaigns)
      .where(and(eq(recoveryCampaigns.id, campaignId), eq(recoveryCampaigns.merchantId, merchantId)))
      .limit(1);

    if (!campaign) {
      throw new AppError(404, 'RECOVERY_CAMPAIGN_NOT_FOUND', 'Recovery campaign not found');
    }

    if (campaign.status === 'completed' || campaign.status === 'cancelled' || campaign.status === 'stopped_by_rule' || campaign.status === 'failed') {
      throw new AppError(409, 'INVALID_CAMPAIGN_STATE', 'Campaign is already terminal');
    }

    const [updated] = await db
      .update(recoveryCampaigns)
      .set({
        status: 'cancelled',
        stoppingReason: reason,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(recoveryCampaigns.id, campaignId), eq(recoveryCampaigns.merchantId, merchantId)))
      .returning();

    await db
      .update(strategies)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(and(eq(strategies.id, campaign.strategyId), eq(strategies.merchantId, merchantId)));

    await db.insert(auditLogs).values({
      merchantId,
      actorUserId: userId,
      entityType: 'recovery_campaign',
      entityId: campaignId,
      action: 'CAMPAIGN_STOPPED',
      metadata: { reason },
    });

    return updated ?? campaign;
  }

  async resumeForUser(userId: string, campaignId: string) {
    const merchantId = await merchantIdForUser(userId);
    const campaign = await this.getByIdForMerchant(merchantId, campaignId);
    if (campaign.status !== 'cancelled') {
      throw new AppError(409, 'INVALID_CAMPAIGN_STATE', 'Only a cancelled campaign can be resumed');
    }

    const resumedAt = new Date();
    const [resumed] = await db
      .update(recoveryCampaigns)
      .set({
        status: 'queued',
        stoppingReason: null,
        completedAt: null,
        updatedAt: resumedAt,
      })
      .where(and(
        eq(recoveryCampaigns.id, campaignId),
        eq(recoveryCampaigns.merchantId, merchantId),
        eq(recoveryCampaigns.status, 'cancelled'),
      ))
      .returning();

    if (!resumed) {
      throw new AppError(409, 'INVALID_CAMPAIGN_STATE', 'Campaign could not be resumed');
    }

    await db
      .update(strategies)
      .set({ status: 'executing', updatedAt: resumedAt })
      .where(and(eq(strategies.id, campaign.strategyId), eq(strategies.merchantId, merchantId)));

    await db.insert(auditLogs).values({
      merchantId,
      actorUserId: userId,
      entityType: 'recovery_campaign',
      entityId: campaignId,
      action: 'CAMPAIGN_STARTED',
      metadata: { resumed: true, resumedAt: resumedAt.toISOString() },
    });

    void this.processCampaign({ campaignId, merchantId, userId });
    return resumed;
  }

  async resolveEligiblePayments(merchantId: string, campaign: any, strategy: any, policyRules?: Record<string, unknown>) {
    const failedPayments = await db
      .select({
        id: payments.id,
        merchantId: payments.merchantId,
        amount: payments.amount,
        currency: payments.currency,
        paymentMethod: payments.paymentMethod,
        status: payments.status,
        createdAt: payments.createdAt,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(and(eq(payments.merchantId, merchantId), eq(payments.status, 'failed')))
      .orderBy(desc(payments.createdAt));

    const paymentIds = failedPayments.map((payment) => payment.id);
    const attempts = paymentIds.length === 0
      ? []
      : await db
        .select({
          paymentId: paymentAttempts.paymentId,
          attemptNumber: paymentAttempts.attemptNumber,
        })
        .from(paymentAttempts)
        .where(and(
          eq(paymentAttempts.merchantId, merchantId),
          inArray(paymentAttempts.paymentId, paymentIds),
        ));
    const highestAttemptByPayment = new Map<string, number>();
    for (const attempt of attempts) {
      const current = highestAttemptByPayment.get(attempt.paymentId) ?? 0;
      highestAttemptByPayment.set(attempt.paymentId, Math.max(current, Number(attempt.attemptNumber)));
    }

    const recoveredExecutions = paymentIds.length === 0
      ? []
      : await db
        .select({ paymentId: recoveryExecutions.paymentId })
        .from(recoveryExecutions)
        .where(and(
          eq(recoveryExecutions.merchantId, merchantId),
          eq(recoveryExecutions.strategyId, campaign.strategyId),
          eq(recoveryExecutions.status, 'success'),
          inArray(recoveryExecutions.paymentId, paymentIds),
        ));
    const recoveredPaymentIds = new Set(recoveredExecutions.map((execution) => execution.paymentId));

    const eligible: Array<{ id: string; amount: string; paymentMethod: 'upi' | 'card' | 'net_banking'; createdAt: Date | null; attemptCount: number; } > = [];
    const skipped: Array<{ paymentId: string; amount: string; reason: string }> = [];

    for (const payment of failedPayments) {
      const attemptCount = highestAttemptByPayment.get(payment.id) ?? 0;
      const alreadyRecovered = recoveredPaymentIds.has(payment.id);
      const expired = isPaymentExpired(payment.createdAt, payment.paidAt);
      const maxAttempts = getMaxAttempts(strategy.configuration);
      const policyAllowed = policyAllowsPayment(payment.paymentMethod, payment.amount, policyRules ?? {});

      if (payment.status !== 'failed') continue;
      if (alreadyRecovered) {
        skipped.push({ paymentId: payment.id, amount: String(payment.amount ?? '0'), reason: 'ALREADY_RECOVERED' });
        continue;
      }
      if (expired) {
        skipped.push({ paymentId: payment.id, amount: String(payment.amount ?? '0'), reason: 'EXPIRED' });
        continue;
      }
      if (attemptCount >= maxAttempts) {
        skipped.push({ paymentId: payment.id, amount: String(payment.amount ?? '0'), reason: 'MAX_RETRIES_REACHED' });
        continue;
      }
      if (!policyAllowed) {
        skipped.push({ paymentId: payment.id, amount: String(payment.amount ?? '0'), reason: 'POLICY_RESTRICTION' });
        continue;
      }

      eligible.push({
        id: payment.id,
        amount: String(payment.amount ?? '0'),
        paymentMethod: payment.paymentMethod as 'upi' | 'card' | 'net_banking',
        createdAt: payment.createdAt,
        attemptCount,
      });
    }

    return { eligible, skipped };
  }

  private async processPaymentAttemptLoop({
    tx,
    campaign,
    merchantId,
    userId,
    strategy,
    payment,
    maxAttempts,
    policyRules,
  }: {
    tx: any;
    campaign: any;
    merchantId: string;
    userId: string;
    strategy: any;
    payment: { id: string; amount: string; paymentMethod: 'upi' | 'card' | 'net_banking'; createdAt: Date | null; attemptCount: number; };
    maxAttempts: number;
    policyRules: Record<string, unknown>;
  }) {
    const idempotencyBase = `${campaign.id}_${payment.id}`;
    let paymentRecovered = false;
    let paymentFailed = false;
    const maxAttemptCount = Math.max(1, maxAttempts);

    for (let attemptNumber = 1; attemptNumber <= maxAttemptCount; attemptNumber += 1) {
      const key = `${idempotencyBase}_attempt_${attemptNumber}`;
      const [existingExecution] = await tx
        .select({ id: recoveryExecutions.id, status: recoveryExecutions.status })
        .from(recoveryExecutions)
        .where(eq(recoveryExecutions.idempotencyKey, key))
        .limit(1);

      if (existingExecution) {
        if (existingExecution.status === 'success') {
          paymentRecovered = true;
          break;
        }
        if (existingExecution.status === 'failed') {
          if (attemptNumber >= maxAttemptCount) {
            paymentFailed = true;
            break;
          }
          continue;
        }
        continue;
      }

      const startedAt = new Date();
      const [record] = await tx
        .insert(recoveryExecutions)
        .values({
          merchantId,
          campaignId: campaign.id,
          paymentId: payment.id,
          strategyId: strategy.id,
          status: 'executing',
          attemptNumber,
          idempotencyKey: key,
          amount: payment.amount,
          recoveredAmount: '0',
          startedAt,
          createdAt: startedAt,
          updatedAt: startedAt,
        })
        .returning();

      if (!record) {
        throw new AppError(500, 'RECOVERY_EXECUTION_CREATION_FAILED', 'Unable to create recovery execution record');
      }

      const outcome = recoveryService.execute(
        {
          id: payment.id,
          merchantId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          createdAt: payment.createdAt,
          attemptCount: Math.max(payment.attemptCount, attemptNumber),
        },
        attemptNumber,
        campaign.id,
      );

      const completedAt = new Date();

      if (outcome.status === 'success') {
        await tx
          .update(recoveryExecutions)
          .set({
            status: 'success',
            recoveredAmount: outcome.recoveredAmount,
            failureReason: null,
            completedAt,
            updatedAt: completedAt,
          })
          .where(eq(recoveryExecutions.id, record.id));

        await tx.insert(auditLogs).values({
          merchantId,
          actorUserId: userId,
          entityType: 'recovery_campaign',
          entityId: campaign.id,
          action: 'PAYMENT_RECOVERED',
          metadata: {
            paymentId: payment.id,
            strategyId: strategy.id,
            amount: outcome.recoveredAmount,
            attemptNumber,
          },
        });

        paymentRecovered = true;
        break;
      }

      await tx
        .update(recoveryExecutions)
        .set({
          status: attemptNumber >= maxAttemptCount ? 'failed' : 'scheduled',
          recoveredAmount: '0',
          failureReason: outcome.failureReason ?? 'MOCK_PROVIDER_FAILURE',
          completedAt,
          updatedAt: completedAt,
        })
        .where(eq(recoveryExecutions.id, record.id));

      await tx.insert(auditLogs).values({
        merchantId,
        actorUserId: userId,
        entityType: 'recovery_campaign',
        entityId: campaign.id,
        action: 'PAYMENT_FAILED',
        metadata: {
          paymentId: payment.id,
          strategyId: strategy.id,
          attemptNumber,
          failureReason: outcome.failureReason ?? 'MOCK_PROVIDER_FAILURE',
        },
      });

      if (attemptNumber >= maxAttemptCount) {
        paymentFailed = true;
        break;
      }
    }

    if (paymentRecovered) {
      return { status: 'success', recoveredAmount: payment.amount };
    }

    if (paymentFailed) {
      return { status: 'failed', recoveredAmount: '0' };
    }

    const policyCheck = policyAllowsPayment(payment.paymentMethod, payment.amount, policyRules);
    if (!policyCheck) {
      return { status: 'skipped', recoveredAmount: '0' };
    }

    return { status: 'failed', recoveredAmount: '0' };
  }

}

function assertAllowedTransition(currentStatus: string, attemptedStatus: string, validFromStatus: string) {
  if (currentStatus !== validFromStatus) {
    throw new AppError(409, 'INVALID_CAMPAIGN_STATE', `Campaign cannot transition to ${attemptedStatus} from ${currentStatus}`);
  }
}

function getMaxAttempts(configuration: Record<string, unknown> | null | undefined): number {
  const raw = configuration && typeof configuration === 'object' ? (configuration as Record<string, unknown>).maxAttempts : undefined;
  const parsed = typeof raw === 'number' ? raw : Number(raw ?? 2);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

function isPaymentExpired(createdAt: Date | null, paidAt: Date | null): boolean {
  const reference = paidAt ?? createdAt ?? new Date();
  const ageMs = Date.now() - reference.getTime();
  return ageMs > 90 * 24 * 60 * 60 * 1000;
}

function policyAllowsPayment(paymentMethod: string, amount: string | number, rules: Record<string, unknown>) {
  const allowedList = Array.isArray(rules.allowedPaymentMethods) ? rules.allowedPaymentMethods as Array<string> : ['upi', 'card', 'net_banking'];
  if (paymentMethod && !allowedList.includes(paymentMethod)) return false;
  const maxDailyExecutionAmount = stringValue(rules.maxDailyExecutionAmount) ?? '100000.0000';
  return compareMoney(String(amount), maxDailyExecutionAmount) <= 0;
}

function compareMoney(left: string, right: string): number {
  return moneyToScale(left) < moneyToScale(right) ? -1 : moneyToScale(left) > moneyToScale(right) ? 1 : 0;
}

function moneyToScale(value: string): bigint {
  const [whole = '0', fraction = '0'] = String(value).split('.');
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0').slice(0, 4));
}

function addMoney(left: string, right: string): string {
  const scale = 10000n;
  const leftScaled = moneyToScale(left);
  const rightScaled = moneyToScale(right);
  const sum = leftScaled + rightScaled;
  const whole = sum / scale;
  const fraction = (sum % scale).toString().padStart(4, '0');
  return `${whole}.${fraction}`;
}

function stringValue(value: unknown): string | undefined {
  const v = typeof value === 'string' ? value : undefined;
  return v;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numberValue(value: unknown): number {
  return Number(value ?? 0);
}

function safePolicyRules(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return value && typeof value === 'object' ? value : {};
}
