import api from './api';

export interface CollegeItem {
  id: string;
  _id: string;
  name: string;
  code: string;
  domains: string[];
  location?: string;
  website?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface VerificationRequestItem {
  id: string;
  _id: string;
  user: {
    _id: string;
    id: string;
    name: string;
    email: string;
    role: 'student' | 'alumni';
    department?: string;
    batch?: string;
    profilePhotoUrl?: string;
    accountStatus: string;
    verificationStatus: string;
  };
  college: CollegeItem;
  role: 'student' | 'alumni';
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  collegeDomainVerified: boolean;
  document?: {
    originalName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  };
  note?: string;
  rejectionReason?: string;
  reviewedBy?: {
    _id: string;
    id: string;
    name: string;
    email: string;
  };
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationFilters {
  status?: string;
  role?: string;
  collegeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const verificationService = {
  // ── Public / Authenticated Discovery ──
  getColleges: (search?: string, page = 1, limit = 50) => {
    const params = new URLSearchParams();
    if (search && search.trim()) params.append('search', search.trim());
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    return api.get<{
      success: boolean;
      data: {
        items: CollegeItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/colleges?${params.toString()}`);
  },

  getCollegeById: (id: string) => {
    return api.get<{
      success: boolean;
      data: { college: CollegeItem };
    }>(`/colleges/${id}`);
  },

  // ── User Submission / Status ──
  submitVerification: (formData: FormData) => {
    return api.post<{
      success: boolean;
      data: {
        message: string;
        verificationRequest: VerificationRequestItem;
        user: any;
      };
    }>('/verification-requests', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getMyVerification: () => {
    return api.get<{
      success: boolean;
      data: {
        hasRequest: boolean;
        verificationRequest: VerificationRequestItem | null;
        user: any;
      };
    }>('/verification-requests/me');
  },

  resubmitVerification: (formData: FormData) => {
    return api.post<{
      success: boolean;
      data: {
        message: string;
        verificationRequest: VerificationRequestItem;
      };
    }>('/verification-requests/resubmit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // ── Document Access ──
  getDocumentDownloadUrl: (requestId: string) => {
    return `${api.defaults.baseURL || '/api/v1'}/verification-requests/${requestId}/document`;
  },

  // ── Admin Verification Queue ──
  getAdminVerificationRequests: (filters: VerificationFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.role) params.append('role', filters.role);
    if (filters.collegeId) params.append('collegeId', filters.collegeId);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    return api.get<{
      success: boolean;
      data: {
        items: VerificationRequestItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/admin/verification-requests?${params.toString()}`);
  },

  approveRequest: (id: string) => {
    return api.patch<{
      success: boolean;
      data: {
        message: string;
        verificationRequest: VerificationRequestItem;
        user: any;
      };
    }>(`/admin/verification-requests/${id}/approve`);
  },

  rejectRequest: (id: string, reason: string) => {
    return api.patch<{
      success: boolean;
      data: {
        message: string;
        verificationRequest: VerificationRequestItem;
        user: any;
      };
    }>(`/admin/verification-requests/${id}/reject`, { reason });
  },
};
