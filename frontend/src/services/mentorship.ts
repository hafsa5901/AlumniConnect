import api from './api';

export type MentorshipStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export interface MentorUser {
  id: string;
  _id: string;
  name: string;
  profilePhotoUrl?: string;
  designation?: string;
  company?: string;
  department?: string;
  batch?: string;
  skills: string[];
  location?: string;
  bio?: string;
  role: string;
  verificationStatus: string;
  requestStatus?: MentorshipStatus | null;
}

export interface MentorshipRequestItem {
  id: string;
  student: {
    id: string;
    name: string;
    profilePhotoUrl?: string;
    department?: string;
    batch?: string;
    role: string;
    email?: string;
  };
  mentor: {
    id: string;
    name: string;
    profilePhotoUrl?: string;
    designation?: string;
    company?: string;
    department?: string;
    batch?: string;
    role: string;
    skills?: string[];
  };
  status: MentorshipStatus;
  topic: string;
  message: string;
  scheduledDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MentorFilters {
  search?: string;
  department?: string;
  company?: string;
  skills?: string;
  location?: string;
  batch?: string;
  page?: number;
  limit?: number;
}

export interface CreateMentorshipRequestPayload {
  mentor: string;
  topic: string;
  message: string;
  scheduledDate?: string | null;
}

export interface UpdateMentorshipStatusPayload {
  status: MentorshipStatus;
  notes?: string;
  scheduledDate?: string | null;
}

export const mentorshipService = {
  listMentors: (filters: MentorFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.department) params.append('department', filters.department);
    if (filters.company) params.append('company', filters.company);
    if (filters.skills) params.append('skills', filters.skills);
    if (filters.location) params.append('location', filters.location);
    if (filters.batch) params.append('batch', filters.batch);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    return api.get<{
      success: boolean;
      data: {
        mentors: MentorUser[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      };
    }>(`/mentorship/mentors?${params.toString()}`);
  },

  getMyRequests: () =>
    api.get<{
      success: boolean;
      data: {
        requests: MentorshipRequestItem[];
      };
    }>('/mentorship/my-requests'),

  createRequest: (payload: CreateMentorshipRequestPayload) =>
    api.post<{
      success: boolean;
      data: {
        request: MentorshipRequestItem;
      };
    }>('/mentorship/requests', payload),

  updateRequestStatus: (id: string, payload: UpdateMentorshipStatusPayload) =>
    api.patch<{
      success: boolean;
      data: {
        request: MentorshipRequestItem;
      };
    }>(`/mentorship/requests/${id}/status`, payload),
};
