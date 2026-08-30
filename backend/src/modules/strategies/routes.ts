import { Router } from 'express';
import { authenticate } from '../../middleware/authentication.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './controller.js';
import { env } from '../../config/env.js';
import { rateLimit } from '../../middleware/rate-limit.js';

export const strategyRouter = Router();
strategyRouter.use(authenticate);
strategyRouter.get('/:id', asyncHandler(controller.getById));
strategyRouter.post('/:id/simulate', asyncHandler(controller.simulate));
strategyRouter.get('/:id/simulations', asyncHandler(controller.listSimulations));
strategyRouter.post('/:id/advisory-review', rateLimit('ai', env.AI_RATE_LIMIT_WINDOW_MS, env.AI_RATE_LIMIT_MAX), asyncHandler(controller.advisoryReview));
strategyRouter.post('/:id/approve', asyncHandler(controller.approve));
