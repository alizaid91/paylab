import { z } from 'zod';

export const paymentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(255).optional(),
  status: z.enum(['pending', 'succeeded', 'failed', 'refunded', 'cancelled']).optional(),
  paymentMethod: z.enum(['upi', 'card', 'net_banking']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'amount', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'from must be earlier than or equal to to',
  path: ['from']
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
