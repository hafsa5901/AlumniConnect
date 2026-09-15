import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../validators/auth';
import { rejectVerificationSchema } from '../validators/verification';
import * as verificationController from '../controllers/verificationController';

const router = Router();

// ── Rate Limiters ─────────────────────────────────────────────────────────────
const submitLimiter = env.AUTH_RATE_LIMIT_DISABLED
  ? (_req: Request, _res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hr
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many verification submissions. Please try again later.' },
        });
      },
    });

const resubmitLimiter = env.AUTH_RATE_LIMIT_DISABLED
  ? (_req: Request, _res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 min
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many resubmission attempts. Please try again later.' },
        });
      },
    });

// ── Multer Configuration: Proof Document ───────────────────────────────────────
const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_MIME_TYPE'));
    }
  },
});

function handleProofUpload(req: Request, res: Response, next: NextFunction): void {
  proofUpload.single('document')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: 'Proof document exceeds maximum limit of 5MB.' },
        });
        return;
      }
      if (err.message === 'INVALID_MIME_TYPE') {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_MIME_TYPE', message: 'Only PDF, PNG, and JPEG formats are supported.' },
        });
        return;
      }
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message || 'File upload failed.' },
      });
      return;
    }
    next();
  });
}

// ── User Verification Routes ──────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  submitLimiter,
  handleProofUpload,
  verificationController.submitVerificationRequest
);

router.get('/me', authenticate, verificationController.getMyVerificationRequest);

router.post(
  '/resubmit',
  authenticate,
  resubmitLimiter,
  handleProofUpload,
  verificationController.resubmitVerificationRequest
);

router.get(
  '/:id/document',
  authenticate,
  verificationController.downloadVerificationDocument
);

export default router;
