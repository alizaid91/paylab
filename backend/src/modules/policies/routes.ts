import { Router } from 'express';
import { authenticate } from '../../middleware/authentication.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './controller.js';

export const policyRouter = Router();
policyRouter.use(authenticate);
policyRouter.post('/strategies/:id/policy-check', asyncHandler(controller.check));
