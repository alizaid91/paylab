import { z } from 'zod';

export const simulationInputSchema = z.object({
  recoveryRate: z.coerce.number().min(0).max(1).default(0.5)
});

export type SimulationInput = z.infer<typeof simulationInputSchema>;
