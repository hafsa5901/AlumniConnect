import { Router } from 'express';
import { referralsController } from '../controllers/referralsController';
import { authenticate } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';

const router = Router();

// 1. Create a new referral request (authenticated & verified active user)
router.post(
  '/',
  authenticate,
  requireVerified,
  referralsController.createReferralRequest
);

// 2. List my submitted referral requests
router.get(
  '/my-requests',
  authenticate,
  referralsController.getMyRequests
);

// 3. List received referral requests (for jobs posted by user or admin)
router.get(
  '/received',
  authenticate,
  referralsController.getReceivedRequests
);

// 4. Get single referral request details
router.get(
  '/:id',
  authenticate,
  referralsController.getReferralById
);

// 5. Update referral request status (accept / reject)
router.patch(
  '/:id/status',
  authenticate,
  requireVerified,
  referralsController.updateReferralStatus
);

// 6. Withdraw pending referral request
router.patch(
  '/:id/withdraw',
  authenticate,
  referralsController.withdrawReferral
);

// 7. Dedicated resume download endpoint for referral requests
router.get(
  '/:referralRequestId/resume',
  authenticate,
  referralsController.handleReferralResumeDownload
);

export default router;
