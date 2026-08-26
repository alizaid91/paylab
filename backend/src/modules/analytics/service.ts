import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { payments } from '../../db/schema.js';
import { merchantIdForUser } from '../../utils/merchant-context.js';
import type { AnalyticsRange, FailureAnalyticsQuery, TrendsQuery } from './validation.js';

type FilterQuery = AnalyticsRange & { merchantId: string };

function rangeConditions(query: FilterQuery) {
  const conditions = [eq(payments.merchantId, query.merchantId)];
  if (query.from) conditions.push(gte(payments.createdAt, query.from));
  if (query.to) conditions.push(lte(payments.createdAt, query.to));
  return and(...conditions);
}

function numberValue(value: unknown): number {
  return Number(value ?? 0);
}

export class AnalyticsService {
  async overviewForUser(userId: string, query: AnalyticsRange) {
    const merchantId = await merchantIdForUser(userId);
    const filters = rangeConditions({ ...query, merchantId });
    const [summary] = await db.select({
      totalPaymentVolume: sql<string>`coalesce(sum(${payments.amount}), 0)`,
      successfulRevenue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'succeeded'), 0)`,
      failedPaymentValue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'failed'), 0)`,
      successfulTransactions: sql<number>`count(*) filter (where ${payments.status} = 'succeeded')`,
      failedTransactions: sql<number>`count(*) filter (where ${payments.status} = 'failed')`,
      totalTransactions: count(),
      averageTransactionValue: sql<string>`coalesce(avg(${payments.amount}), 0)`,
      retriedTransactions: sql<number>`count(*) filter (where exists (
        select 1 from payment_attempts pa
        where pa.payment_id = ${payments.id}
          and pa.merchant_id = ${merchantId}
          and pa.attempt_number > 1
      ))`
    }).from(payments).where(filters);

    const totalTransactions = numberValue(summary?.totalTransactions);
    const successfulTransactions = numberValue(summary?.successfulTransactions);
    const failedTransactions = numberValue(summary?.failedTransactions);
    const retriedTransactions = numberValue(summary?.retriedTransactions);
    return {
      totalPaymentVolume: summary?.totalPaymentVolume ?? '0',
      successfulRevenue: summary?.successfulRevenue ?? '0',
      failedPaymentValue: summary?.failedPaymentValue ?? '0',
      successfulTransactions,
      failedTransactions,
      successRate: percentage(successfulTransactions, totalTransactions),
      failureRate: percentage(failedTransactions, totalTransactions),
      averageTransactionValue: summary?.averageTransactionValue ?? '0',
      retryRate: percentage(retriedTransactions, totalTransactions)
    };
  }

  async paymentMethodsForUser(userId: string, query: AnalyticsRange) {
    const merchantId = await merchantIdForUser(userId);
    const filters = rangeConditions({ ...query, merchantId });
    const rows = await db.select({
      paymentMethod: payments.paymentMethod,
      transactionCount: count(),
      volume: sql<string>`coalesce(sum(${payments.amount}), 0)`,
      successfulTransactions: sql<number>`count(*) filter (where ${payments.status} = 'succeeded')`,
      failedTransactions: sql<number>`count(*) filter (where ${payments.status} = 'failed')`,
      failedPaymentValue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'failed'), 0)`
    }).from(payments).where(filters).groupBy(payments.paymentMethod);

    return rows.map((row) => {
      const total = numberValue(row.transactionCount);
      const successful = numberValue(row.successfulTransactions);
      const failed = numberValue(row.failedTransactions);
      return {
        paymentMethod: row.paymentMethod,
        transactionCount: total,
        volume: row.volume,
        successfulTransactions: successful,
        failedTransactions: failed,
        successRate: percentage(successful, total),
        failureRate: percentage(failed, total),
        failedPaymentValue: row.failedPaymentValue
      };
    });
  }

  async failuresForUser(userId: string, query: FailureAnalyticsQuery) {
    const merchantId = await merchantIdForUser(userId);
    const filters = rangeConditions({ ...query, merchantId });
    const dimension = query.groupBy === 'paymentMethod'
      ? payments.paymentMethod
      : query.groupBy === 'hour'
        ? sql<number>`extract(hour from ${payments.createdAt})::int`
        : query.groupBy === 'date'
          ? sql<string>`to_char(${payments.createdAt}, 'YYYY-MM-DD')`
          : sql<string>`coalesce(${payments.metadata}->>'device', 'unknown')`;
    const rows = await db.select({
      dimension,
      failedTransactions: sql<number>`count(*) filter (where ${payments.status} = 'failed')`,
      failedPaymentValue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'failed'), 0)`,
      totalTransactions: count()
    }).from(payments).where(filters).groupBy(dimension);

    return {
      groupBy: query.groupBy,
      items: rows.map((row) => ({
        dimension: row.dimension,
        failedTransactions: numberValue(row.failedTransactions),
        failedPaymentValue: row.failedPaymentValue ?? '0',
        totalTransactions: numberValue(row.totalTransactions),
        failureRate: percentage(numberValue(row.failedTransactions), numberValue(row.totalTransactions))
      }))
    };
  }

  async trendsForUser(userId: string, query: TrendsQuery) {
    const merchantId = await merchantIdForUser(userId);
    const filters = rangeConditions({ ...query, merchantId });
    const interval = sql.raw(`'${query.interval}'`);
    const bucket = sql<Date>`date_trunc(${interval}, ${payments.createdAt})`;
    const rows = await db.select({
      period: bucket,
      transactions: count(),
      volume: sql<string>`coalesce(sum(${payments.amount}), 0)`,
      successfulRevenue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'succeeded'), 0)`,
      failedPaymentValue: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'failed'), 0)`,
      successfulTransactions: sql<number>`count(*) filter (where ${payments.status} = 'succeeded')`,
      failedTransactions: sql<number>`count(*) filter (where ${payments.status} = 'failed')`
    }).from(payments).where(filters).groupBy(bucket).orderBy(bucket);

    return {
      interval: query.interval,
      items: rows.map((row) => {
        const transactions = numberValue(row.transactions);
        const successful = numberValue(row.successfulTransactions);
        return {
          period: row.period instanceof Date ? row.period.toISOString() : String(row.period),
          transactions,
          volume: row.volume,
          successfulRevenue: row.successfulRevenue,
          failedPaymentValue: row.failedPaymentValue,
          successfulTransactions: successful,
          failedTransactions: numberValue(row.failedTransactions),
          successRate: percentage(successful, transactions)
        };
      })
    };
  }
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2));
}
