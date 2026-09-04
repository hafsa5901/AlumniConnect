import { Router } from 'express';
import { mentorshipController } from '../controllers/mentorshipController';
import { authenticate, requireRole } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';

const router = Router();

// Mentors Discovery (authenticated, all roles)
router.get('/mentors', authenticate, mentorshipController.listMentors);

// My Mentorship Requests (students & alumni)
router.get('/my-requests', authenticate, mentorshipController.getMyRequests);

// Request Mentorship (verified students only)
router.post(
  '/requests',
  authenticate,
  requireVerified,
  requireRole('student'),
  mentorshipController.createRequest
);

// Update Request Status (verified mentors only)
router.patch(
  '/requests/:id/status',
  authenticate,
  requireVerified,
  mentorshipController.updateRequestStatus
);

export default router;
