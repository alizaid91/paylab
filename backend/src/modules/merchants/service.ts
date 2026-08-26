import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { merchants } from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import type { MerchantUpdateInput } from '../auth/validation.js';

export class MerchantService {
  async getForUser(userId: string) {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.ownerUserId, userId)).limit(1);
    if (!merchant) throw new AppError(404, 'MERCHANT_NOT_FOUND', 'Merchant profile not found');
    return merchant;
  }

  async updateForUser(userId: string, input: MerchantUpdateInput) {
    await this.getForUser(userId);
    try {
      const [merchant] = await db.update(merchants).set({ ...input, updatedAt: new Date() })
        .where(eq(merchants.ownerUserId, userId)).returning();
      if (!merchant) throw new AppError(404, 'MERCHANT_NOT_FOUND', 'Merchant profile not found');
      return merchant;
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'SLUG_ALREADY_EXISTS', 'Merchant slug is already in use');
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
