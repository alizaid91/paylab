import type { RequestHandler } from 'express';
import { sendSuccess } from '../../utils/api-response.js';
import { AnalyticsService } from './service.js';
import { analyticsRangeSchema, failureAnalyticsQuerySchema, trendsQuerySchema } from './validation.js';

const service = new AnalyticsService();

export const overview: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.overviewForUser(req.auth!.userId, analyticsRangeSchema.parse(req.query)));
};

export const paymentMethods: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.paymentMethodsForUser(req.auth!.userId, analyticsRangeSchema.parse(req.query)));
};

export const failures: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.failuresForUser(req.auth!.userId, failureAnalyticsQuerySchema.parse(req.query)));
};

export const trends: RequestHandler = async (req, res) => {
  sendSuccess(res, await service.trendsForUser(req.auth!.userId, trendsQuerySchema.parse(req.query)));
};
