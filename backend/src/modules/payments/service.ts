import { and, asc, count, desc, eq, gte, lte, sql, sum } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { paymentAttempts, payments } from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import { merchantIdForUser } from '../../utils/merchant-context.js';
import type { PaymentListQuery } from './validation.js';

type PaymentFilters = {
  merchantId: string;
  query: PaymentListQuery;
};

export class PaymentService {
  async listForUser(userId: string, query: PaymentListQuery) {
    const merchantId = await merchantIdForUser(userId);
    const filters = this.conditions({ merchantId, query });
    const offset = (query.page - 1) * query.pageSize;
    const orderColumn = query.sortBy === 'amount' ? payments.amount : query.sortBy === 'status' ? payments.status : payments.createdAt;
    const order = query.sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(payments).where(filters).orderBy(order).limit(query.pageSize).offset(offset),
      db.select({ total: count() }).from(payments).where(filters)
    ]);
    const totalItems = Number(total);
    return {
      items: rows,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
        hasNextPage: offset + rows.length < totalItems,
        hasPreviousPage: query.page > 1
      }
    };
  }

  async getByIdForUser(userId: string, paymentId: string) {
    const merchantId = await merchantIdForUser(userId);
    const [payment] = await db.select().from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.merchantId, merchantId))).limit(1);
    if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    const attempts = await db.select().from(paymentAttempts)
      .where(and(eq(paymentAttempts.paymentId, payment.id), eq(paymentAttempts.merchantId, merchantId)))
      .orderBy(asc(paymentAttempts.attemptNumber));
    return { ...payment, attempts };
  }

  async statsForUser(userId: string, query: Pick<PaymentListQuery, 'status' | 'paymentMethod' | 'from' | 'to'>) {
    const merchantId = await merchantIdForUser(userId);
    const filters = this.conditions({ merchantId, query: { ...query, page: 1, pageSize: 1, sortBy: 'createdAt', sortOrder: 'desc' } });
    const [summary, byStatus] = await Promise.all([
      db.select({
        totalTransactions: count(),
        totalAmount: sum(payments.amount),
        successfulAmount: sql<string>`coalesce(sum(case when ${payments.status} = 'succeeded' then ${payments.amount} else 0 end), 0)`,
        failedTransactions: sql<number>`count(*) filter (where ${payments.status} = 'failed')`
      }).from(payments).where(filters),
      db.select({ status: payments.status, count: count(), amount: sum(payments.amount) })
        .from(payments).where(filters).groupBy(payments.status)
    ]);
    return {
      totalTransactions: Number(summary[0]?.totalTransactions ?? 0),
      totalAmount: summary[0]?.totalAmount ?? '0',
      successfulAmount: summary[0]?.successfulAmount ?? '0',
      failedTransactions: Number(summary[0]?.failedTransactions ?? 0),
      byStatus: byStatus.map((item) => ({ ...item, count: Number(item.count), amount: item.amount ?? '0' }))
    };
  }

  private conditions({ merchantId, query }: PaymentFilters) {
    const conditions = [eq(payments.merchantId, merchantId)];
    if (query.status) conditions.push(eq(payments.status, query.status));
    if (query.paymentMethod) conditions.push(eq(payments.paymentMethod, query.paymentMethod));
    if (query.from) conditions.push(gte(payments.createdAt, query.from));
    if (query.to) conditions.push(lte(payments.createdAt, query.to));
    return and(...conditions);
  }
}
