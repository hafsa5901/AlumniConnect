import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { validate } from '../validators/auth';
import { updateProfileSchema } from '../validators/user';
import * as usersController from '../controllers/usersController';

const router = Router();

// ── Multer Configuration ──────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_MIME_TYPE'));
    }
  },
});

function handlePhotoUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Image size exceeds maximum limit of 5MB.',
          },
        });
        return;
      }
      if (err.message === 'INVALID_MIME_TYPE') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Only JPEG, PNG, and WebP image formats are supported.',
          },
        });
        return;
      }
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message || 'File upload failed.',
        },
      });
      return;
    }
    next();
  });
}

// ── User Routes ───────────────────────────────────────────────────────────────
router.get('/me', authenticate, usersController.getMe);
router.patch('/me', authenticate, validate(updateProfileSchema), usersController.updateMe);
router.post('/me/photo', authenticate, handlePhotoUpload, usersController.uploadPhoto);

export default router;
