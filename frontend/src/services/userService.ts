import api from './api';
import { User } from '../types';

export interface ProfileUpdatePayload {
  bio?: string;
  location?: string;
  skills?: string[];
  education?: Array<{
    institution: string;
    degree: string;
    field: string;
    startYear: number;
    endYear?: number;
  }>;
  links?: Record<string, string>;
  company?: string;
  designation?: string;
  experience?: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    description?: string;
  }>;
  mentorshipEnabled?: boolean;
}

export const userService = {
  getMe: () =>
    api.get<{ success: boolean; data: { user: User; profileCompletion: number; hasResume?: boolean } }>('/users/me'),

  updateProfile: (data: ProfileUpdatePayload) =>
    api.patch<{ success: boolean; data: { user: User; profileCompletion: number; hasResume?: boolean } }>('/users/me', data),

  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api.post<{ success: boolean; data: { profilePhotoUrl: string } }>('/users/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadResume: (file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    return api.post<{ success: boolean; data: { resume: { originalName: string; mimeType: string; size: number; uploadedAt: string } } }>(
      '/users/me/resume',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
  },

  deleteResume: () =>
    api.delete<{ success: boolean; data: { message: string } }>('/users/me/resume'),

  getResumeDownloadUrl: (userId?: string) => `/api/v1/users/${userId || 'me'}/resume`,

  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    api.post<{ success: boolean; data: { message: string } }>('/auth/change-password', data),

  getStudentDashboard: () => api.get('/dashboard/student'),
  getAlumniDashboard: () => api.get('/dashboard/alumni'),
  getAdminDashboard: () => api.get('/dashboard/admin'),
};
