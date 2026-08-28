import { Router } from 'express';
import { authenticate } from '../../middleware/authentication.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './controller.js';

export const auditLogRouter = Router();
auditLogRouter.use(authenticate);
auditLogRouter.get('/', asyncHandler(controller.list));
