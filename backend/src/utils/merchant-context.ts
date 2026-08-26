import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { merchants } from '../db/schema.js';
import { AppError } from './app-error.js';

export async function merchantIdForUser(userId: string): Promise<string> {
  const [merchant] = await db.select({ id: merchants.id }).from(merchants)
    .where(eq(merchants.ownerUserId, userId)).limit(1);
  if (!merchant) throw new AppError(404, 'MERCHANT_NOT_FOUND', 'Merchant profile not found');
  return merchant.id;
}
