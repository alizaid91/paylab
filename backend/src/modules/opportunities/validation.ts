import { z } from 'zod';

export const opportunityListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['open', 'in_review', 'accepted', 'dismissed', 'expired']).optional(),
  type: z.enum(['upi_evening_failure', 'mobile_card_failure', 'customer_retry_behavior', 'other']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional()
});

export type OpportunityListQuery = z.infer<typeof opportunityListQuerySchema>;
