import api from './api';
import { ApiResponse, ReferralRequestItem } from '../types';

export interface CreateReferralPayload {
  jobId: string;
  message: string;
  resumeIncluded?: boolean;
}

export interface UpdateReferralStatusPayload {
  status: 'accepted' | 'rejected';
  responseNote?: string;
}

export const referralsService = {
  // Create referral request
  createReferralRequest: (data: CreateReferralPayload) =>
    api.post<ApiResponse<{ referral: ReferralRequestItem }>>('/referrals', data),

  // Get my submitted referral requests
  getMyRequests: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<ApiResponse<{ items: ReferralRequestItem[]; total: number; page: number; totalPages: number }>>(
      '/referrals/my-requests',
      { params }
    ),

  // Get received referral requests (for job posters & admins)
  getReceivedRequests: (params?: { page?: number; limit?: number; jobId?: string; status?: string }) =>
    api.get<ApiResponse<{ items: ReferralRequestItem[]; total: number; page: number; totalPages: number }>>(
      '/referrals/received',
      { params }
    ),

  // Get single referral request detail
  getReferralById: (id: string) =>
    api.get<ApiResponse<{ referral: ReferralRequestItem }>>(`/referrals/${id}`),

  // Update status (poster accepts or declines)
  updateStatus: (id: string, data: UpdateReferralStatusPayload) =>
    api.patch<ApiResponse<{ referral: ReferralRequestItem }>>(`/referrals/${id}/status`, data),

  // Withdraw pending referral request
  withdrawReferral: (id: string) =>
    api.patch<ApiResponse<{ referral: ReferralRequestItem }>>(`/referrals/${id}/withdraw`),

  // Download applicant resume for this referral request
  downloadReferralResume: (referralId: string) =>
    api.get(`/referrals/${referralId}/resume`, {
      responseType: 'blob',
    }),
};

export default referralsService;
