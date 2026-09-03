import { Router } from 'express';
import { eventsController } from '../controllers/eventsController';
import { authenticate, requireRole } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';

const router = Router();

// Event Listings & Detail (all authenticated users)
router.get('/', authenticate, eventsController.listEvents);
router.get('/:id', authenticate, eventsController.getEventById);
router.get('/:id/attendees', authenticate, eventsController.getEventAttendees);

// Event Creation (verified alumni or admin)
router.post(
  '/',
  authenticate,
  requireVerified,
  requireRole('alumni', 'admin'),
  eventsController.createEvent
);

// Event Moderation (admin only)
router.patch('/:id/approve', authenticate, requireRole('admin'), eventsController.approveEvent);
router.patch('/:id/reject', authenticate, requireRole('admin'), eventsController.rejectEvent);

// RSVPs (verified users)
router.post('/:id/rsvp', authenticate, requireVerified, eventsController.rsvpEvent);
router.delete('/:id/rsvp', authenticate, requireVerified, eventsController.cancelRsvp);

export default router;
