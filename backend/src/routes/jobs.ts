import { Router, Request, Response, NextFunction } from 'express';
import { jobsController } from '../controllers/jobsController';
import { authenticate, requireRole } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';
import { verifyAccessToken } from '../utils/auth';
import User from '../models/User';

const router = Router();

/**
 * Optional authentication helper:
 * Attaches req.user if a valid token is provided, otherwise proceeds without failing.
 */
async function authenticateOptional(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7);
    let payload: { userId: string; role: string };
    try {
      payload = verifyAccessToken(token);
    } catch {
      return next();
    }

    const user = await User.findById(payload.userId).select(
      '_id name email role accountStatus verificationStatus'
    );
    if (user && user.accountStatus === 'active') {
      req.user = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        verificationStatus: user.verificationStatus,
      };
    }
    next();
  } catch {
    next();
  }
}

// Jobs Listings & Detail
router.get('/', authenticateOptional, jobsController.listJobs);
router.get('/:id', authenticateOptional, jobsController.getJobById);

// Job Creation (verified alumni or admin)
router.post(
  '/',
  authenticate,
  requireVerified,
  requireRole('alumni', 'admin'),
  jobsController.createJob
);

// Job Edit (verified alumni owner or admin)
router.patch(
  '/:id',
  authenticate,
  requireVerified,
  requireRole('alumni', 'admin'),
  jobsController.updateJob
);

// Job Deletion (owner alumni or admin)
router.delete(
  '/:id',
  authenticate,
  requireRole('alumni', 'admin'),
  jobsController.deleteJob
);

export default router;
