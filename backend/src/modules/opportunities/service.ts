import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { opportunities, payments, strategies } from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import { merchantIdForUser } from '../../utils/merchant-context.js';
import type { OpportunityListQuery } from './validation.js';

const ACTIVE_STATUSES = ['open', 'in_review'] as const;
const EVENING_START = 19;
const EVENING_END = 22;
const MIN_TRANSACTIONS = 5;
const MIN_FAILURE_RATE = 5;
const MIN_RATE_LIFT = 2;

type Candidate = {
  type: 'upi_evening_failure' | 'mobile_card_failure' | 'customer_retry_behavior';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  category: string;
  priority: number;
  affectedTransactionCount: number;
  affectedPaymentValue: string;
  estimatedOpportunityValue: string;
  confidence: number;
  evidence: Record<string, unknown>;
};

export class OpportunityService {
  async analyzeForUser(userId: string) {
    const merchantId = await merchantIdForUser(userId);
    const detectedAt = new Date();
    const created: Array<typeof opportunities.$inferSelect> = [];

    await db.transaction(async (tx) => {
      const persist = async (candidate: Candidate) => {
        const [existing] = await tx.select({ id: opportunities.id }).from(opportunities).where(and(
          eq(opportunities.merchantId, merchantId),
          eq(opportunities.type, candidate.type),
          inArray(opportunities.status, ACTIVE_STATUSES)
        )).limit(1);
        if (existing) return;

        const [opportunity] = await tx.insert(opportunities).values({
          merchantId,
          type: candidate.type,
          severity: candidate.severity,
          category: candidate.category,
          title: candidate.title,
          description: candidate.description,
          priority: candidate.priority,
          affectedTransactionCount: candidate.affectedTransactionCount,
          affectedPaymentValue: candidate.affectedPaymentValue,
          estimatedOpportunityValue: candidate.estimatedOpportunityValue,
          estimatedImpact: candidate.estimatedOpportunityValue,
          confidence: candidate.confidence.toFixed(2),
          evidence: candidate.evidence,
          detectedAt,
          createdAt: detectedAt,
          updatedAt: detectedAt
        }).onConflictDoNothing().returning();
        if (opportunity) created.push(opportunity);
      };

      const [upi] = await tx.select({
        eveningTotal: sql<number>`count(*) filter (where extract(hour from ${payments.createdAt}) between ${EVENING_START} and ${EVENING_END})`,
        eveningFailed: sql<number>`count(*) filter (where ${payments.status} = 'failed' and extract(hour from ${payments.createdAt}) between ${EVENING_START} and ${EVENING_END})`,
        eveningFailedValue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'failed' and extract(hour from ${payments.createdAt}) between ${EVENING_START} and ${EVENING_END}), 0)`,
        baselineTotal: sql<number>`count(*) filter (where extract(hour from ${payments.createdAt}) not between ${EVENING_START} and ${EVENING_END})`,
        baselineFailed: sql<number>`count(*) filter (where ${payments.status} = 'failed' and extract(hour from ${payments.createdAt}) not between ${EVENING_START} and ${EVENING_END})`
      }).from(payments).where(and(eq(payments.merchantId, merchantId), eq(payments.paymentMethod, 'upi')));
      const eveningTotal = toNumber(upi?.eveningTotal);
      const eveningFailed = toNumber(upi?.eveningFailed);
      const baselineTotal = toNumber(upi?.baselineTotal);
      const eveningRate = rate(eveningFailed, eveningTotal);
      const baselineRate = rate(toNumber(upi?.baselineFailed), baselineTotal);
      if (eveningTotal >= MIN_TRANSACTIONS && eveningRate >= MIN_FAILURE_RATE && eveningRate - baselineRate >= MIN_RATE_LIFT) {
        await persist({
          type: 'upi_evening_failure',
          severity: severity(eveningRate - baselineRate),
          title: 'UPI Evening Failure',
          description: `UPI payments fail more often between 19:00 and 22:00 than during other hours, indicating a time-specific payment conversion problem.`,
          category: 'payment_reliability',
          priority: 90,
          affectedTransactionCount: eveningFailed,
          affectedPaymentValue: upi?.eveningFailedValue ?? '0',
          estimatedOpportunityValue: recoverable(upi?.eveningFailedValue),
          confidence: confidence(eveningTotal, eveningRate - baselineRate),
          evidence: {
            failureRate: eveningRate,
            baselineFailureRate: baselineRate,
            timeWindow: '19:00-22:00',
            affectedTransactions: eveningFailed,
            affectedPaymentValue: upi?.eveningFailedValue ?? '0',
            sampleSize: eveningTotal,
            threshold: { minimumFailureRate: MIN_FAILURE_RATE, minimumRateLift: MIN_RATE_LIFT }
          }
        });
      }

      const [mobileCard] = await tx.select({
        mobileTotal: sql<number>`count(*) filter (where ${payments.metadata}->>'device' = 'mobile')`,
        mobileFailed: sql<number>`count(*) filter (where ${payments.status} = 'failed' and ${payments.metadata}->>'device' = 'mobile')`,
        mobileFailedValue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'failed' and ${payments.metadata}->>'device' = 'mobile'), 0)`,
        desktopTotal: sql<number>`count(*) filter (where coalesce(${payments.metadata}->>'device', 'desktop') <> 'mobile')`,
        desktopFailed: sql<number>`count(*) filter (where ${payments.status} = 'failed' and coalesce(${payments.metadata}->>'device', 'desktop') <> 'mobile')`
      }).from(payments).where(and(eq(payments.merchantId, merchantId), eq(payments.paymentMethod, 'card')));
      const mobileTotal = toNumber(mobileCard?.mobileTotal);
      const mobileFailed = toNumber(mobileCard?.mobileFailed);
      const mobileRate = rate(mobileFailed, mobileTotal);
      const desktopRate = rate(toNumber(mobileCard?.desktopFailed), toNumber(mobileCard?.desktopTotal));
      if (mobileTotal >= MIN_TRANSACTIONS && mobileRate >= MIN_FAILURE_RATE && mobileRate - desktopRate >= MIN_RATE_LIFT) {
        await persist({
          type: 'mobile_card_failure',
          severity: severity(mobileRate - desktopRate),
          title: 'Mobile Card Failure',
          description: 'Card payments made from mobile devices have a materially higher failure rate than non-mobile card payments.',
          category: 'payment_reliability',
          priority: 85,
          affectedTransactionCount: mobileFailed,
          affectedPaymentValue: mobileCard?.mobileFailedValue ?? '0',
          estimatedOpportunityValue: recoverable(mobileCard?.mobileFailedValue),
          confidence: confidence(mobileTotal, mobileRate - desktopRate),
          evidence: {
            failureRate: mobileRate,
            baselineFailureRate: desktopRate,
            device: 'mobile',
            paymentMethod: 'card',
            affectedTransactions: mobileFailed,
            affectedPaymentValue: mobileCard?.mobileFailedValue ?? '0',
            sampleSize: mobileTotal,
            threshold: { minimumFailureRate: MIN_FAILURE_RATE, minimumRateLift: MIN_RATE_LIFT }
          }
        });
      }

      const customerRows = await tx.select({
        customerId: payments.customerId,
        failedTransactions: sql<number>`count(*) filter (where ${payments.status} = 'failed')`,
        retriedTransactions: sql<number>`count(*) filter (where exists (
          select 1 from payment_attempts pa
          where pa.payment_id = ${payments.id}
            and pa.merchant_id = ${merchantId}
            and pa.attempt_number > 1
        ))`,
        affectedPaymentValue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'failed'), 0)`
      }).from(payments).where(and(eq(payments.merchantId, merchantId), sql`${payments.customerId} is not null`))
        .groupBy(payments.customerId)
        .having(sql`count(*) filter (where ${payments.status} = 'failed') >= 2 or count(*) filter (where exists (
          select 1 from payment_attempts pa
          where pa.payment_id = ${payments.id}
            and pa.merchant_id = ${merchantId}
            and pa.attempt_number > 1
        )) >= 2`);
      const affectedTransactions = customerRows.reduce((total, row) => total + toNumber(row.failedTransactions), 0);
      const affectedValue = customerRows.reduce((total, row) => addMoney(total, row.affectedPaymentValue ?? '0'), '0.0000');
      const retryCustomers = customerRows.filter((row) => toNumber(row.retriedTransactions) > 0).length;
      if (customerRows.length > 0) {
        await persist({
          type: 'customer_retry_behavior',
          severity: customerRows.length >= 5 ? 'high' : 'medium',
          title: 'Customers With Repeated Payment Failures',
          description: 'Several customers show repeated failed payments or retry attempts, indicating recoverable revenue at the customer level.',
          category: 'customer_recovery',
          priority: 80,
          affectedTransactionCount: affectedTransactions,
          affectedPaymentValue: affectedValue,
          estimatedOpportunityValue: recoverable(affectedValue),
          confidence: confidence(affectedTransactions, customerRows.length),
          evidence: {
            affectedCustomers: customerRows.length,
            customersWithRetries: retryCustomers,
            affectedTransactions,
            affectedPaymentValue: affectedValue,
            rule: 'customer has at least 2 failed payments or at least 2 retried payments',
            threshold: { minimumFailedPayments: 2, minimumRetries: 2 }
          }
        });
      }
    });

    return { detectedAt, created, createdCount: created.length };
  }

  async listForUser(userId: string, query: OpportunityListQuery) {
    const merchantId = await merchantIdForUser(userId);
    const conditions = [eq(opportunities.merchantId, merchantId)];
    if (query.status) conditions.push(eq(opportunities.status, query.status));
    if (query.type) conditions.push(eq(opportunities.type, query.type));
    if (query.severity) conditions.push(eq(opportunities.severity, query.severity));
    const offset = (query.page - 1) * query.pageSize;
    const [items, [{ total }]] = await Promise.all([
      db.select().from(opportunities).where(and(...conditions)).orderBy(desc(opportunities.detectedAt)).limit(query.pageSize).offset(offset),
      db.select({ total: count() }).from(opportunities).where(and(...conditions))
    ]);
    const totalItems = Number(total);
    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
        hasNextPage: offset + items.length < totalItems,
        hasPreviousPage: query.page > 1
      }
    };
  }

  async getByIdForUser(userId: string, opportunityId: string) {
    const merchantId = await merchantIdForUser(userId);
    const [opportunity] = await db.select().from(opportunities).where(and(
      eq(opportunities.id, opportunityId),
      eq(opportunities.merchantId, merchantId)
    )).limit(1);
    if (!opportunity) throw new AppError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');

    const relatedStrategies = await db.select({
      id: strategies.id,
      name: strategies.name,
      type: strategies.type,
      status: strategies.status,
      version: strategies.version,
      createdAt: strategies.createdAt,
      updatedAt: strategies.updatedAt
    }).from(strategies).where(and(
      eq(strategies.opportunityId, opportunityId),
      eq(strategies.merchantId, merchantId)
    )).orderBy(desc(strategies.createdAt));

    return {
      ...opportunity,
      strategies: relatedStrategies
    };
  }
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function rate(failed: number, total: number): number {
  return total === 0 ? 0 : Number(((failed / total) * 100).toFixed(2));
}

function severity(lift: number): Candidate['severity'] {
  return lift >= 15 ? 'critical' : lift >= 8 ? 'high' : lift >= 4 ? 'medium' : 'low';
}

function confidence(sampleSize: number, lift: number): number {
  return Math.min(99, Number((50 + Math.min(sampleSize, 100) / 2 + Math.min(Math.max(lift, 0), 20)).toFixed(2)));
}

function recoverable(value: string | null | undefined): string {
  return multiplyMoney(value ?? '0', 1, 2);
}

function addMoney(left: string, right: string): string {
  const scale = 4;
  const leftScaled = toScaledInteger(left, scale);
  const rightScaled = toScaledInteger(right, scale);
  return fromScaledInteger(leftScaled + rightScaled, scale);
}

function multiplyMoney(value: string, numerator: number, denominator: number): string {
  const scaled = toScaledInteger(value, 4);
  return fromScaledInteger((scaled * BigInt(numerator)) / BigInt(denominator), 4);
}

function toScaledInteger(value: string, scale: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  const sign = whole.startsWith('-') ? -1n : 1n;
  const absoluteWhole = whole.replace('-', '');
  return sign * (BigInt(absoluteWhole || '0') * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0').slice(0, scale) || '0'));
}

function fromScaledInteger(value: bigint, scale: number): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const divisor = 10n ** BigInt(scale);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(scale, '0');
  return `${sign}${whole}.${fraction}`;
}
