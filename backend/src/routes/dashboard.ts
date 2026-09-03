import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboardController';

const router = Router();

router.get(
  '/student',
  authenticate,
  requireRole('student'),
  dashboardController.getStudentDashboard
);

router.get(
  '/alumni',
  authenticate,
  requireRole('alumni'),
  dashboardController.getAlumniDashboard
);

router.get(
  '/admin',
  authenticate,
  requireRole('admin'),
  dashboardController.getAdminDashboard
);

export default router;
