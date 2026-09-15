import { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Global REST API Rate Limiter
 *
 * Configured baseline:
 * - 100 requests per 15-minute window per IP address for general endpoints.
 * - /api/health is explicitly exempt from rate limiting for monitoring probes.
 * - Auth routes (/api/v1/auth) manage their own dedicated stricter limits and are skipped here to prevent double-limiting.
 * - In test environments or when AUTH_RATE_LIMIT_DISABLED is true, requests pass through without throttling.
 */
export const globalApiRateLimiter: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  // Bypass if disabled via configuration or running in automated test mode
  if (env.AUTH_RATE_LIMIT_DISABLED || env.NODE_ENV === 'test') {
    return next();
  }

  // Exempt health checks
  if (req.path === '/api/health' || req.path === '/health') {
    return next();
  }

  // Exempt auth routes so they rely exclusively on dedicated auth rate limiters
  if (req.baseUrl.startsWith('/api/v1/auth') || req.path.startsWith('/api/v1/auth')) {
    return next();
  }

  return standardLimiter(req, res, next);
};

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'GLOBAL_RATE_LIMITED',
      message: 'Too many requests from this IP address. Please try again after 15 minutes.',
    },
  },
  handler: (_req, res, _next, options) => {
    res.status(429).json(options.message);
  },
});
