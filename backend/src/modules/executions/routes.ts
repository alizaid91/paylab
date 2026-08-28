import { Router } from 'express';
import { authenticate } from '../../middleware/authentication.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './controller.js';

export const executionRouter = Router();
executionRouter.use(authenticate);
executionRouter.get('/', asyncHandler(controller.list));
executionRouter.get('/:id', asyncHandler(controller.getById));
