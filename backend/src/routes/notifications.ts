import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationsController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// All notification routes are strictly authenticated
router.use(authenticate);

// 1. List notifications (cursor-based)
router.get('/', asyncHandler(getNotifications));

// 2. Unread count badge
router.get('/unread-count', asyncHandler(getUnreadCount));

// 3. Mark single notification as read
router.patch('/:id/read', asyncHandler(markAsRead));

// 4. Mark all notifications as read
router.patch('/read-all', asyncHandler(markAllAsRead));

export default router;
