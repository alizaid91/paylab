import { Router } from 'express';
import { authenticate } from '../../middleware/authentication.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './controller.js';

export const recoveryCampaignRouter = Router();
recoveryCampaignRouter.use(authenticate);
recoveryCampaignRouter.post('/', asyncHandler(controller.create));
recoveryCampaignRouter.get('/', asyncHandler(controller.list));
recoveryCampaignRouter.post('/:id/start', asyncHandler(controller.start));
recoveryCampaignRouter.post('/:id/stop', asyncHandler(controller.stop));
recoveryCampaignRouter.post('/:id/resume', asyncHandler(controller.resume));
recoveryCampaignRouter.get('/:id', asyncHandler(controller.getById));
