import api from './api';

export type NotificationType =
  | 'mentorship_request'
  | 'mentorship_accepted'
  | 'mentorship_rejected'
  | 'mentorship_completed'
  | 'new_message'
  | 'event_approved'
  | 'event_rejected'
  | 'job_removed_by_admin';

export type RelatedEntityType = 'mentorship' | 'message' | 'conversation' | 'event' | 'job' | 'user';

export interface NotificationActor {
  _id?: string;
  id?: string;
  name: string;
  profilePhotoUrl?: string;
  role: string;
}

export interface NotificationItem {
  id: string;
  _id?: string;
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  readAt?: string | null;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string;
  actor?: NotificationActor;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

export const notificationService = {
  getNotifications: (before?: string | null, limit = 20) => {
    return api.get<{ success: boolean; data: NotificationsResponse }>('/notifications', {
      params: { before: before || undefined, limit },
    });
  },

  getUnreadCount: () => {
    return api.get<{ success: boolean; data: { unreadCount: number } }>('/notifications/unread-count');
  },

  markAsRead: (id: string) => {
    return api.patch<{ success: boolean; data: { notification: NotificationItem } }>(
      `/notifications/${id}/read`
    );
  },

  markAllAsRead: () => {
    return api.patch<{ success: boolean; data: { modifiedCount: number } }>(
      '/notifications/read-all'
    );
  },
};
