import { and, asc, count, desc, eq, gte, ilike, lte, sql, sum } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { customers, merchants, paymentAttempts, payments } from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import { merchantIdForUser } from '../../utils/merchant-context.js';
import type { PaymentListQuery } from './validation.js';
import { generateDemoData } from './demo-data.js';

type PaymentFilters = {
  merchantId: string;
  query: PaymentListQuery;
};

export class PaymentService {
  async generateDemoDataForUser(userId: string) {
    const merchantId = await merchantIdForUser(userId);
    const result = await db.transaction(async (tx) => {
      const [merchant] = await tx.select({ dataSource: merchants.dataSource })
        .from(merchants)
        .where(eq(merchants.id, merchantId))
        .for("update");
      if (!merchant) {
        throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant profile not found");
      }
      if (merchant.dataSource === "demo") {
        throw new AppError(409, "DEMO_DATA_ALREADY_CONNECTED", "Demo data is already connected for this merchant");
      }
      if (merchant.dataSource === "razorpay_live") {
        throw new AppError(409, "DATA_SOURCE_ALREADY_CONNECTED", "A live data source is already connected for this merchant");
      }

      const [{ paymentCount }] = await tx.select({ paymentCount: count() })
        .from(payments)
        .where(eq(payments.merchantId, merchantId));
      if (Number(paymentCount) > 0) {
        return { generated: false, customers: 0, payments: Number(paymentCount), paymentAttempts: 0 };
      }

      const generated = {
        generated: true,
        ...(await generateDemoData(tx, merchantId))
      };
      await tx.update(merchants)
        .set({ dataSource: 'demo', updatedAt: new Date() })
        .where(eq(merchants.id, merchantId));
      return generated;
    });
    return result;
  }

  async listForUser(userId: string, query: PaymentListQuery) {
    const merchantId = await merchantIdForUser(userId);
    const filters = this.conditions({ merchantId, query });
    const offset = (query.page - 1) * query.pageSize;
    const orderColumn = query.sortBy === 'amount' ? payments.amount : query.sortBy === 'status' ? payments.status : payments.createdAt;
    const order = query.sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);
    const [rows, [{ total }], [summary]] = await Promise.all([
      db.select({
        id: payments.id,
        externalId: payments.externalId,
        customerId: payments.customerId,
        customerExternalId: customers.externalId,
        customerName: customers.name,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        paymentMethod: payments.paymentMethod,
        provider: payments.provider,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        attemptCount: sql<number>`count(${paymentAttempts.id})::int`
      }).from(payments)
        .leftJoin(customers, eq(payments.customerId, customers.id))
        .leftJoin(paymentAttempts, eq(payments.id, paymentAttempts.paymentId))
        .where(filters)
        .groupBy(payments.id, customers.externalId, customers.name)
        .orderBy(order)
        .limit(query.pageSize)
        .offset(offset),
      db.select({ total: count() }).from(payments)
        .leftJoin(customers, eq(payments.customerId, customers.id))
        .where(filters),
      db.select({
        totalPayments: count(),
        successfulPayments: sql<number>`count(*) filter (where ${payments.status} = 'succeeded')`,
        failedPayments: sql<number>`count(*) filter (where ${payments.status} = 'failed')`,
        totalPaymentValue: sum(payments.amount)
      }).from(payments)
        .leftJoin(customers, eq(payments.customerId, customers.id))
        .where(filters)
    ]);
    const totalItems = Number(total);
    const totalPayments = Number(summary?.totalPayments ?? 0);
    const successfulPayments = Number(summary?.successfulPayments ?? 0);
    return {
      items: rows,
      summary: {
        totalPayments,
        successfulPayments,
        failedPayments: Number(summary?.failedPayments ?? 0),
        totalPaymentValue: summary?.totalPaymentValue ?? '0',
        successRate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0
      },
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
    const [payment] = await db.select({
      id: payments.id,
      externalId: payments.externalId,
      merchantId: payments.merchantId,
      customerId: payments.customerId,
      customerExternalId: customers.externalId,
      customerName: customers.name,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      paymentMethod: payments.paymentMethod,
      provider: payments.provider,
      paidAt: payments.paidAt,
      metadata: payments.metadata,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt
    }).from(payments)
      .leftJoin(customers, eq(payments.customerId, customers.id))
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
    if (query.search) conditions.push(sql`(${ilike(payments.externalId, `%${query.search}%`)} or ${ilike(customers.externalId, `%${query.search}%`)})`);
    if (query.status) conditions.push(eq(payments.status, query.status));
    if (query.paymentMethod) conditions.push(eq(payments.paymentMethod, query.paymentMethod));
    if (query.from) conditions.push(gte(payments.createdAt, query.from));
    if (query.to) conditions.push(lte(payments.createdAt, query.to));
    return and(...conditions);
  }
}
