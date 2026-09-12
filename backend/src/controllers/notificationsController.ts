import { Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import Notification from '../models/Notification';
import notificationService from '../services/notificationService';
import { createError } from '../middleware/errorHandler';

/**
 * GET /api/v1/notifications
 * Cursor-based pagination with ?before=&limit=
 * Scoped strictly to caller's recipient ID.
 */
export async function getNotifications(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user!._id;
  const { before } = req.query;
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const query: any = { recipient: currentUserId };

  if (before) {
    if (typeof before === 'string' && mongoose.isValidObjectId(before)) {
      query._id = { $lt: new Types.ObjectId(before) };
    }
  }

  // Fetch limit + 1 to determine hasMore
  const rawItems = await Notification.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate({
      path: 'actor',
      select: '_id name profilePhotoUrl role',
    });

  const hasMore = rawItems.length > limit;
  const sliced = hasMore ? rawItems.slice(0, limit) : rawItems;
  const nextCursor = sliced.length > 0 ? sliced[sliced.length - 1]._id.toString() : null;

  res.status(200).json({
    success: true,
    data: {
      notifications: sliced,
      hasMore,
      nextCursor,
    },
  });
}

/**
 * GET /api/v1/notifications/unread-count
 * Returns unread count for current user
 */
export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user!._id;
  const unreadCount = await notificationService.getUnreadCount(currentUserId);

  res.status(200).json({
    success: true,
    data: {
      unreadCount,
    },
  });
}

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a single notification as read (404 on not found or cross-user)
 */
export async function markAsRead(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const currentUserId = req.user!._id;

  if (!id || !mongoose.isValidObjectId(id)) {
    throw createError('Notification not found.', 404, 'NOT_FOUND');
  }

  const notification = await notificationService.markAsRead(id, currentUserId);
  if (!notification) {
    throw createError('Notification not found.', 404, 'NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: {
      notification,
    },
  });
}

/**
 * PATCH /api/v1/notifications/read-all
 * Marks all notifications for caller as read
 */
export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  const currentUserId = req.user!._id;
  const modifiedCount = await notificationService.markAllAsRead(currentUserId);

  res.status(200).json({
    success: true,
    data: {
      modifiedCount,
    },
  });
}
