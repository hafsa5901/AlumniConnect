import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { authenticate } from '../middleware/auth';
import { validate } from '../validators/auth';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth';
import * as authController from '../controllers/authController';

const router = Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────
function makeRateLimiter(max: number, windowMs: number, code = 'RATE_LIMITED'): RequestHandler {
  if (env.AUTH_RATE_LIMIT_DISABLED) return (_req, _res, next) => next();
  return rateLimit({
    max,
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: { code, message: 'Too many requests. Please try again later.' },
      });
    },
  });
}

const loginLimiter    = makeRateLimiter(5,  15 * 60 * 1000); // 5/15min
const registerLimiter = makeRateLimiter(10,  60 * 60 * 1000); // 10/hr
const forgotLimiter   = makeRateLimiter(5,  15 * 60 * 1000); // 5/15min

// ── Public routes ─────────────────────────────────────────────────────────────
router.post('/register',        registerLimiter, validate(registerSchema),       authController.register);
router.post('/login',           loginLimiter,    validate(loginSchema),           authController.login);
router.post('/verify-email',                                                      authController.verifyEmail);
router.post('/forgot-password', forgotLimiter,   validate(forgotPasswordSchema),  authController.forgotPassword);
router.post('/reset-password',                   validate(resetPasswordSchema),   authController.resetPassword);
router.post('/refresh',                                                           authController.refresh);

// ── Protected routes ──────────────────────────────────────────────────────────
router.post('/logout', authenticate, authController.logout);
router.get('/me',      authenticate, authController.getMe);

export default router;
