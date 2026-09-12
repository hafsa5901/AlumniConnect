import mongoose, { Types } from 'mongoose';
import Notification, { INotification, NotificationType, RelatedEntityType } from '../models/Notification';
import User from '../models/User';
import { emitToUser } from '../socket';

export interface CreateNotificationParams {
  recipient: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string | Types.ObjectId;
  actor?: string | Types.ObjectId;
}

export class NotificationService {
  /**
   * createNotification
   * Persists notification first. If recipient is currently active, emits real-time 'notification:new' over Socket.IO.
   * Guarantees idempotency for one-shot event types (mentorship, event, job moderation).
   */
  async createNotification(params: CreateNotificationParams): Promise<INotification> {
    const recipientId = new Types.ObjectId(params.recipient.toString());
    const actorId = params.actor ? new Types.ObjectId(params.actor.toString()) : undefined;
    const relatedEntityId = params.relatedEntityId
      ? new Types.ObjectId(params.relatedEntityId.toString())
      : undefined;

    // Idempotency: One-shot event types deduplicate on (recipient, type, relatedEntityId)
    // new_message is explicitly exempted from deduplication
    if (params.type !== 'new_message' && relatedEntityId) {
      const existing = await Notification.findOne({
        recipient: recipientId,
        type: params.type,
        relatedEntityId,
      });
      if (existing) {
        return existing;
      }
    }

    const notification = await Notification.create({
      recipient: recipientId,
      type: params.type,
      title: params.title,
      message: params.message,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId,
      actor: actorId,
    });

    // Populate safe actor details for projection
    const populated = await Notification.findById(notification._id).populate({
      path: 'actor',
      select: '_id name profilePhotoUrl role',
    });

    // Real-time delivery: live status re-validation
    try {
      const recipientUser = await User.findById(recipientId).select('accountStatus');
      if (recipientUser && recipientUser.accountStatus === 'active') {
        const payload = populated ? populated.toJSON() : notification.toJSON();
        emitToUser(recipientId.toString(), 'notification:new', {
          notification: payload,
        });
      }
    } catch (err) {
      // Real-time delivery failure must never fail the persistence/business operation
      console.error('[NotificationService] Socket emit error:', err);
    }

    return populated || notification;
  }

  /**
   * createNotifications
   * Bulk creation helper
   */
  async createNotifications(items: CreateNotificationParams[]): Promise<INotification[]> {
    const results: INotification[] = [];
    for (const item of items) {
      const created = await this.createNotification(item);
      results.push(created);
    }
    return results;
  }

  /**
   * getUnreadCount
   */
  async getUnreadCount(userId: string | Types.ObjectId): Promise<number> {
    const recipientId = new Types.ObjectId(userId.toString());
    return Notification.countDocuments({
      recipient: recipientId,
      readAt: null,
    });
  }

  /**
   * markAsRead
   * Scoped to caller's ownership.
   */
  async markAsRead(
    notificationId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<INotification | null> {
    if (!mongoose.isValidObjectId(notificationId)) {
      return null;
    }

    const notifId = new Types.ObjectId(notificationId.toString());
    const recipientId = new Types.ObjectId(userId.toString());

    return Notification.findOneAndUpdate(
      { _id: notifId, recipient: recipientId },
      { $set: { readAt: new Date() } },
      { new: true }
    ).populate({
      path: 'actor',
      select: '_id name profilePhotoUrl role',
    });
  }

  /**
   * markAllAsRead
   * Marks all unread notifications for a user as read.
   */
  async markAllAsRead(userId: string | Types.ObjectId): Promise<number> {
    const recipientId = new Types.ObjectId(userId.toString());
    const result = await Notification.updateMany(
      { recipient: recipientId, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return result.modifiedCount;
  }

  /**
   * markMessageNotificationsRead
   * Synchronizes message read-state: marks new_message notifications for a conversation as read.
   */
  async markMessageNotificationsRead(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<number> {
    const recipientId = new Types.ObjectId(userId.toString());
    const convId = new Types.ObjectId(conversationId.toString());

    const result = await Notification.updateMany(
      {
        recipient: recipientId,
        type: 'new_message',
        relatedEntityId: convId,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      }
    );

    return result.modifiedCount;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
