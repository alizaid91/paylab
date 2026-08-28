import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ExecutionService } from './service.js';
import { sendSuccess } from '../../utils/api-response.js';

const service = new ExecutionService();
const idSchema = z.string().uuid();

export const list: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.listForUser(req.auth!.userId));
};

export const getById: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.getByIdForUser(req.auth!.userId, idSchema.parse(req.params.id)));
};
