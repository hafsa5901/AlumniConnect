import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  Bell,
  CheckCheck,
  MessageSquare,
  Users,
  Calendar,
  Briefcase,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  notificationService,
  NotificationItem,
  NotificationType,
} from '../../services/notification';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../feedback/EmptyState';
import toast from 'react-hot-toast';

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'new_message':
      return <MessageSquare className="w-4 h-4 text-emerald-500" />;
    case 'mentorship_request':
      return <Users className="w-4 h-4 text-indigo-500" />;
    case 'mentorship_accepted':
      return <UserCheck className="w-4 h-4 text-emerald-500" />;
    case 'mentorship_rejected':
      return <UserX className="w-4 h-4 text-rose-500" />;
    case 'mentorship_completed':
      return <UserCheck className="w-4 h-4 text-blue-500" />;
    case 'event_approved':
      return <Calendar className="w-4 h-4 text-emerald-500" />;
    case 'event_rejected':
      return <AlertTriangle className="w-4 h-4 text-rose-500" />;
    case 'job_removed_by_admin':
      return <Briefcase className="w-4 h-4 text-amber-500" />;
    default:
      return <Bell className="w-4 h-4 text-slate-500" />;
  }
}

export const NotificationsPopover: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // ── 1. Fetch initial unread count on mount ─────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.data.data.unreadCount || 0);
    } catch {
      // Ignore unauthenticated / network errors
    }
  }, []);

  // ── 2. Fetch notifications list when popover opens ──────────────────────
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await notificationService.getNotifications(null, 20);
      const list = res.data.data.notifications || [];
      setNotifications(list);
      setHasMore(res.data.data.hasMore || false);
      setNextCursor(res.data.data.nextCursor || null);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      toast.error('Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMoreNotifications = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await notificationService.getNotifications(nextCursor, 20);
      const moreItems = res.data.data.notifications || [];
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id || n._id));
        const filtered = moreItems.filter((n) => !existingIds.has(n.id || n._id));
        return [...prev, ...filtered];
      });
      setHasMore(res.data.data.hasMore || false);
      setNextCursor(res.data.data.nextCursor || null);
    } catch (err) {
      console.error('Failed to load more notifications:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [isOpen, fetchNotifications, fetchUnreadCount]);

  // ── 3. Real-time Socket.IO listener ─────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('notification:new', (data: { notification: NotificationItem }) => {
      if (!data?.notification) return;
      const newNotif = data.notification;

      setNotifications((prev) => {
        const id = newNotif.id || newNotif._id;
        if (prev.some((n) => (n.id || n._id) === id)) {
          return prev;
        }
        return [newNotif, ...prev];
      });

      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ── 4. Click outside to close ───────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // ── 5. Actions: Mark one / Mark all / Navigate ──────────────────────────
  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: n.readAt || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
      toast.success('All notifications marked as read.');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      toast.error('Failed to mark all as read.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    const notifId = notif.id || notif._id;

    // Optimistically mark as read
    if (!notif.readAt && notifId) {
      try {
        await notificationService.markAsRead(notifId);
        setNotifications((prev) =>
          prev.map((n) =>
            (n.id || n._id) === notifId
              ? { ...n, readAt: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    }

    setIsOpen(false);

    // Deep-link navigation based on type
    switch (notif.type) {
      case 'new_message':
        if (notif.relatedEntityId) {
          navigate(`/messages?id=${notif.relatedEntityId}`);
        } else {
          navigate('/messages');
        }
        break;
      case 'mentorship_request':
      case 'mentorship_accepted':
      case 'mentorship_rejected':
      case 'mentorship_completed':
        navigate('/mentorship');
        break;
      case 'event_approved':
      case 'event_rejected':
        if (notif.relatedEntityId) {
          navigate(`/events/${notif.relatedEntityId}`);
        } else {
          navigate('/events');
        }
        break;
      case 'job_removed_by_admin':
        navigate('/jobs');
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-btn text-slate-500 hover:text-navy-900 hover:bg-slate-50 transition-colors relative"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full ring-2 ring-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <span className="sr-only">{unreadCount} unread notifications</span>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-card shadow-modal border border-slate-200 py-2 z-50 animate-slide-up flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                Notifications
              </h4>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-navy-50 text-navy-700 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="text-[11px] font-semibold text-navy-600 hover:text-navy-800 flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-200 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded w-full" />
                      <div className="h-2 bg-slate-100 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  type="notifications"
                  title="No notifications yet"
                  description="You are all caught up. Campus announcements, message alerts, and mentorship updates will appear here."
                />
              </div>
            ) : (
              notifications.map((notif) => {
                const notifId = notif.id || notif._id;
                const isUnread = !notif.readAt;

                return (
                  <button
                    key={notifId}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 hover:bg-slate-50 relative ${
                      isUnread ? 'bg-navy-50/40' : 'bg-white'
                    }`}
                  >
                    {/* Actor Avatar or Type Icon */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      {notif.actor?.profilePhotoUrl ? (
                        <Avatar
                          src={notif.actor.profilePhotoUrl}
                          name={notif.actor.name}
                          size="sm"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          {getNotificationIcon(notif.type)}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white shadow-xs flex items-center justify-center">
                        {getNotificationIcon(notif.type)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-xs truncate ${
                            isUnread ? 'font-bold text-navy-900' : 'font-semibold text-slate-700'
                          }`}
                        >
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-400 flex-shrink-0 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {/* Unread Indicator Dot */}
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-navy-600 flex-shrink-0 mt-2" />
                    )}
                  </button>
                );
              })
            )}

            {/* Load More Button */}
            {hasMore && !isLoading && (
              <div className="p-2 text-center border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={loadMoreNotifications}
                  disabled={isLoadingMore}
                  className="text-[11px] font-semibold text-navy-600 hover:text-navy-800 transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? 'Loading older...' : 'Load older notifications'}
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-1.5 border-t border-slate-100 text-center bg-slate-50/30">
            <span className="text-[10px] font-medium text-slate-400">Institutional Alerts Feed</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPopover;
