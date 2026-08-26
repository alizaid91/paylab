import { z } from 'zod';

const passwordSchema = z.string().min(8).max(128).regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z.object({
  email: z.string().trim().email().max(320),
  password: passwordSchema,
  merchant: z.object({
    name: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    defaultCurrency: z.string().trim().length(3).toUpperCase().default('USD'),
    timezone: z.string().trim().min(1).max(100).default('UTC')
  }).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128)
});

export const merchantUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  defaultCurrency: z.string().trim().length(3).toUpperCase().optional(),
  timezone: z.string().trim().min(1).max(100).optional()
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MerchantUpdateInput = z.infer<typeof merchantUpdateSchema>;
