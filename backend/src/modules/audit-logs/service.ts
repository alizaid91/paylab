import { and, asc, eq, or, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { auditLogs } from '../../db/schema.js';
import { merchantIdForUser } from '../../utils/merchant-context.js';

export class AuditLogService {
  async listForUser(userId: string, strategyId?: string, executionId?: string, campaignId?: string) {
    const merchantId = await merchantIdForUser(userId);
    const conditions = [eq(auditLogs.merchantId, merchantId)];
    if (strategyId || executionId || campaignId) {
      conditions.push(or(
        strategyId ? sql`${auditLogs.metadata}->>'strategyId' = ${strategyId}` : undefined,
        executionId ? eq(auditLogs.entityId, executionId) : undefined,
        campaignId ? eq(auditLogs.entityId, campaignId) : undefined
      )!);
    }
    return db.select().from(auditLogs).where(and(...conditions)).orderBy(asc(auditLogs.createdAt));
  }
}
