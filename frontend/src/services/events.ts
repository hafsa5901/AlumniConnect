import api from './api';

export type EventCategory = 'webinar' | 'reunion' | 'workshop' | 'career' | 'networking';
export type EventLocationType = 'virtual' | 'in_person' | 'hybrid';
export type EventApprovalStatus = 'pending' | 'approved' | 'rejected';
export type RSVPStatus = 'attending' | 'cancelled';

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  startDate: string;
  endDate: string;
  locationType: EventLocationType;
  venueOrLink: string;
  organizer: {
    _id: string;
    name: string;
    profilePhotoUrl?: string;
    designation?: string;
    company?: string;
    department?: string;
    role: string;
  };
  capacity: number | null;
  approvalStatus: EventApprovalStatus;
  rejectionReason?: string;
  bannerUrl?: string;
  attendingCount: number;
  spotsRemaining: number | null;
  userRsvpStatus: RSVPStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventAttendee {
  user: {
    _id: string;
    name: string;
    profilePhotoUrl?: string;
    role: string;
    department?: string;
    batch?: string;
  };
  registeredAt: string;
}

export interface EventFilters {
  category?: string;
  timeframe?: 'upcoming' | 'past';
  search?: string;
  mine?: boolean;
  status?: EventApprovalStatus;
  page?: number;
  limit?: number;
}

export interface CreateEventPayload {
  title: string;
  description: string;
  category: EventCategory;
  startDate: string;
  endDate: string;
  locationType: EventLocationType;
  venueOrLink: string;
  capacity?: number | null;
  bannerUrl?: string | null;
}

export const eventsService = {
  listEvents: (filters: EventFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.timeframe) params.append('timeframe', filters.timeframe);
    if (filters.search) params.append('search', filters.search);
    if (filters.mine) params.append('mine', 'true');
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    return api.get<{
      success: boolean;
      data: {
        events: EventItem[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      };
    }>(`/events?${params.toString()}`);
  },

  getEventById: (id: string) =>
    api.get<{ success: boolean; data: { event: EventItem } }>(`/events/${id}`),

  getEventAttendees: (id: string) =>
    api.get<{ success: boolean; data: { attendees: EventAttendee[]; count: number } }>(
      `/events/${id}/attendees`
    ),

  createEvent: (payload: CreateEventPayload) =>
    api.post<{ success: boolean; data: { event: EventItem } }>('/events', payload),

  approveEvent: (id: string) =>
    api.patch<{ success: boolean; data: { event: { id: string; approvalStatus: string } } }>(
      `/events/${id}/approve`
    ),

  rejectEvent: (id: string, reason?: string) =>
    api.patch<{
      success: boolean;
      data: { event: { id: string; approvalStatus: string; rejectionReason?: string } };
    }>(`/events/${id}/reject`, { reason }),

  rsvpEvent: (id: string) =>
    api.post<{
      success: boolean;
      data: { message: string; attendingCount: number; spotsRemaining: number | null };
    }>(`/events/${id}/rsvp`),

  cancelRsvp: (id: string) =>
    api.delete<{
      success: boolean;
      data: { message: string; attendingCount: number; spotsRemaining: number | null };
    }>(`/events/${id}/rsvp`),
};
