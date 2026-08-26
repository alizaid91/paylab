import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../config/logger.js';
import { sendError } from '../utils/api-response.js';
import { AppError } from '../utils/app-error.js';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  logger.error({ err: error, method: req.method, url: req.originalUrl }, 'Unhandled request error');
  if (error instanceof ZodError) {
    sendError(res, 'VALIDATION_ERROR', 'Request validation failed', 400, error.issues);
    return;
  }
  if (error instanceof AppError) {
    sendError(res, error.code, error.message, error.statusCode, error.details);
    return;
  }
  const message = env.NODE_ENV === 'development' && error instanceof Error ? error.message : 'An unexpected error occurred';
  sendError(res, 'INTERNAL_SERVER_ERROR', message, 500);
};
