import type { RequestHandler } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/api-response.js';
import { PaymentService } from './service.js';
import { paymentListQuerySchema } from './validation.js';

const service = new PaymentService();
const idSchema = z.string().uuid();

export const listPayments: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.listForUser(req.auth!.userId, paymentListQuerySchema.parse(req.query)));
};

export const getPayment: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.getByIdForUser(req.auth!.userId, idSchema.parse(req.params.id)));
};

export const getPaymentStats: RequestHandler = async (req, res) => {
  const query = paymentListQuerySchema.pick({ status: true, paymentMethod: true, from: true, to: true }).parse(req.query);
  sendSuccess(res, await service.statsForUser(req.auth!.userId, query));
};
