import { pinoHttp } from 'pino-http';
import { logger } from '../config/logger.js';

export const requestLogger = pinoHttp({
  logger,
  redact: ['req.headers.authorization', 'req.headers.cookie']
});
