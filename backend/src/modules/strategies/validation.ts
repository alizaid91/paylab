import { z } from 'zod';

export const simulationInputSchema = z.object({}).strict();

export const advisoryReviewInputSchema = z.object({
  simulationId: z.string().uuid()
});

export type SimulationInput = z.infer<typeof simulationInputSchema>;
export type AdvisoryReviewInput = z.infer<typeof advisoryReviewInputSchema>;
