import api from './api';
import {
  AnnouncementCategory,
  AnnouncementItem,
  AnnouncementListResponse,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '../types';

export interface AnnouncementQueryParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
}

export interface AdminAnnouncementQueryParams extends AnnouncementQueryParams {
  status?: 'all' | 'draft' | 'published';
}

export function getCategoryBadgeVariant(
  category: string
): 'red' | 'blue' | 'green' | 'purple' | 'amber' | 'navy' | 'gray' {
  switch (category) {
    case 'Important':
      return 'red';
    case 'Academic':
      return 'blue';
    case 'Placements':
      return 'green';
    case 'Internships':
      return 'purple';
    case 'Workshops':
      return 'amber';
    case 'Events':
      return 'navy';
    default:
      return 'gray';
  }
}

export function validateCoverImageUrl(url: string): { valid: boolean; error?: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: true };
  }
  if (trimmed.length > 2048) {
    return { valid: false, error: 'Cover image URL must not exceed 2048 characters.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Cover image URL must use the https:// protocol.' };
    }
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'Cover image URL must not contain credentials.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Please provide a valid HTTPS URL.' };
  }
}

export function formatAnnouncementDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Unpublished Draft';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const announcementsService = {
  getAnnouncements: (params?: AnnouncementQueryParams) => {
    return api.get<{ success: boolean; data: AnnouncementListResponse }>('/announcements', {
      params,
    });
  },

  getManageAnnouncements: (params?: AdminAnnouncementQueryParams) => {
    return api.get<{ success: boolean; data: AnnouncementListResponse }>('/announcements/manage', {
      params,
    });
  },

  getAnnouncementById: async (id: string): Promise<AnnouncementItem> => {
    const res = await api.get<{ success: boolean; data: { announcement: AnnouncementItem } }>(
      `/announcements/${id}`
    );
    return res.data.data.announcement;
  },

  createAnnouncement: async (payload: CreateAnnouncementInput): Promise<AnnouncementItem> => {
    const res = await api.post<{ success: boolean; data: { announcement: AnnouncementItem } }>(
      '/announcements',
      payload
    );
    return res.data.data.announcement;
  },

  updateAnnouncement: async (id: string, payload: UpdateAnnouncementInput): Promise<AnnouncementItem> => {
    const res = await api.patch<{ success: boolean; data: { announcement: AnnouncementItem } }>(
      `/announcements/${id}`,
      payload
    );
    return res.data.data.announcement;
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    await api.delete<{ success: boolean; data: { message: string } }>(
      `/announcements/${id}`
    );
  },
};
