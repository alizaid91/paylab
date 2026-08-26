import { z } from 'zod';

const dateRange = {
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
};

export const analyticsRangeSchema = z.object(dateRange).refine(
  (value) => !value.from || !value.to || value.from <= value.to,
  { message: 'from must be earlier than or equal to to', path: ['from'] }
);

export const failureAnalyticsQuerySchema = analyticsRangeSchema.extend({
  groupBy: z.enum(['paymentMethod', 'hour', 'date', 'device']).default('paymentMethod')
});

export const trendsQuerySchema = analyticsRangeSchema.extend({
  interval: z.enum(['day', 'week', 'month']).default('day')
});

export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;
export type FailureAnalyticsQuery = z.infer<typeof failureAnalyticsQuerySchema>;
export type TrendsQuery = z.infer<typeof trendsQuerySchema>;
