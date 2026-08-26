import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { merchants, users } from '../../db/schema.js';
import { AppError } from '../../utils/app-error.js';
import { createAccessToken } from '../../middleware/authentication.js';
import type { LoginInput, RegisterInput } from './validation.js';

const SALT_ROUNDS = 12;

function publicUser(user: typeof users.$inferSelect) {
  return { id: user.id, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt, updatedAt: user.updatedAt };
}

export class AuthService {
  async register(input: RegisterInput) {
    const email = input.email.toLowerCase();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists');

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    try {
      const result = await db.transaction(async (tx) => {
        const [user] = await tx.insert(users).values({
          email,
          passwordHash,
          role: 'merchant_admin'
        }).returning();
        if (!user) throw new AppError(500, 'USER_CREATION_FAILED', 'Unable to create user');

        let merchant;
        if (input.merchant) {
          [merchant] = await tx.insert(merchants).values({
            ownerUserId: user.id,
            name: input.merchant.name,
            slug: input.merchant.slug,
            defaultCurrency: input.merchant.defaultCurrency,
            timezone: input.merchant.timezone
          }).returning();
        }
        return { user, merchant };
      });
      return { user: publicUser(result.user), merchant: result.merchant ?? null, accessToken: createAccessToken(result.user.id) };
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'RESOURCE_ALREADY_EXISTS', 'A resource with these unique fields already exists');
      throw error;
    }
  }

  async login(input: LoginInput) {
    const email = input.email.toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    return { user: publicUser(user), accessToken: createAccessToken(user.id) };
  }

  async getCurrentUser(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.isActive) throw new AppError(401, 'UNAUTHENTICATED', 'User account is unavailable');
    const [merchant] = await db.select().from(merchants).where(eq(merchants.ownerUserId, user.id)).limit(1);
    return { user: publicUser(user), merchant: merchant ?? null };
  }
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
