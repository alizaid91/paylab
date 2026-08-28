import { Router } from 'express';
import { authenticate } from '../../middleware/authentication.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './controller.js';

export const policyRouter = Router();
policyRouter.use(authenticate);
policyRouter.get('/merchant/policies', asyncHandler(controller.get));
policyRouter.put('/merchant/policies', asyncHandler(controller.update));
policyRouter.post('/strategies/:id/policy-check', asyncHandler(controller.check));
