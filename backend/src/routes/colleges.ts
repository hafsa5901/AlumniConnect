import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createCollegeSchema, updateCollegeSchema } from '../validators/college';
import * as collegeController from '../controllers/collegeController';

const router = Router();

// Public / Authenticated discovery
router.get('/', collegeController.listColleges);
router.get('/:id', collegeController.getCollegeById);

// Admin-only master data management
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validate(createCollegeSchema),
  collegeController.createCollege
);

router.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(updateCollegeSchema),
  collegeController.updateCollege
);

export default router;
