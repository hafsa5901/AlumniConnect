import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { validate, rejectUserSchema } from '../validators/auth';
import { rejectVerificationSchema } from '../validators/verification';
import * as adminController from '../controllers/adminController';
import * as verificationController from '../controllers/verificationController';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

router.get('/dashboard',                           adminController.getDashboardStats);
router.get('/analytics/overview',                  adminController.getAnalyticsOverview);
router.get('/analytics/activity',                  adminController.getAnalyticsActivity);
router.post('/users/bulk-action',                  adminController.bulkUserAction);
router.get('/users',                               adminController.listUsers);
router.get('/users/:id',                           adminController.getUserById);
router.patch('/users/:id/approve',                 adminController.approveUser);
router.patch('/users/:id/reject',                  validate(rejectUserSchema), adminController.rejectUser);
router.patch('/users/:id/suspend',                 adminController.suspendUser);
router.patch('/users/:id/reactivate',              adminController.reactivateUser);
router.patch('/users/:id/role',                    adminController.changeUserRole);
router.get('/audit-logs',                          adminController.getAuditLogs);

// Institutional Verification Queue
router.get('/verification-requests',               verificationController.listAdminVerificationRequests);
router.patch('/verification-requests/:id/approve', verificationController.approveAdminVerificationRequest);
router.patch('/verification-requests/:id/reject',  validate(rejectVerificationSchema), verificationController.rejectAdminVerificationRequest);

export default router;
