import { Router } from 'express';
import { announcementsController } from '../controllers/announcementsController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Public Feed (all active authenticated users)
router.get('/', authenticate, announcementsController.listAnnouncements);

// Admin Management Endpoint (MUST be defined before /:id)
router.get(
  '/manage',
  authenticate,
  requireRole('admin'),
  announcementsController.manageAnnouncements
);

// Detail Endpoint
router.get('/:id', authenticate, announcementsController.getAnnouncementById);

// Admin Write Endpoints
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  announcementsController.createAnnouncement
);

router.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  announcementsController.updateAnnouncement
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  announcementsController.deleteAnnouncement
);

export default router;
