import { Router } from 'express';
import { authenticate } from '../../middleware/authentication.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './controller.js';
import { env } from '../../config/env.js';
import { rateLimit } from '../../middleware/rate-limit.js';

export const opportunityRouter = Router();
opportunityRouter.use(authenticate);
opportunityRouter.post('/analyze', asyncHandler(controller.analyze));
opportunityRouter.post('/:id/generate-strategy', rateLimit('ai', env.AI_RATE_LIMIT_WINDOW_MS, env.AI_RATE_LIMIT_MAX), asyncHandler(controller.generateStrategy));
opportunityRouter.get('/', asyncHandler(controller.list));
opportunityRouter.get('/:id', asyncHandler(controller.getById));
