import api from './api';

export interface AdminUserFilters {
  status?: string;
  role?: string;
  verificationStatus?: string;
  department?: string;
  batch?: string;
  company?: string;
  institution?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminUserItem {
  id: string;
  _id: string;
  name: string;
  email: string;
  role: 'student' | 'alumni' | 'admin';
  accountStatus: 'active' | 'suspended' | 'deactivated';
  verificationStatus: 'pending' | 'email_verified' | 'admin_approved' | 'rejected';
  department?: string;
  batch?: string;
  company?: string;
  designation?: string;
  institution?: string;
  location?: string;
  studentId?: string;
  alumniId?: string;
  profilePhotoUrl?: string;
  bio?: string;
  skills?: string[];
  education?: Array<{ institution: string; degree: string; field: string; startYear: number; endYear?: number }>;
  experience?: Array<{ company: string; title: string; startDate: string; endDate?: string; description?: string }>;
  links?: Record<string, string>;
  mentorshipEnabled?: boolean;
  verificationNote?: string;
  verificationDocUrl?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface AuditLogItem {
  id: string;
  admin: {
    _id: string;
    id: string;
    name: string;
    email: string;
    role: string;
    profilePhotoUrl?: string;
  };
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: string;
  actor?: string;
  targetUser?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const adminService = {
  getUsers: (filters: AdminUserFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.role) params.append('role', filters.role);
    if (filters.verificationStatus) params.append('verificationStatus', filters.verificationStatus);
    if (filters.department) params.append('department', filters.department);
    if (filters.batch) params.append('batch', filters.batch);
    if (filters.company) params.append('company', filters.company);
    if (filters.institution) params.append('institution', filters.institution);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    return api.get<any>(`/admin/users?${params.toString()}`);
  },

  getUserById: (id: string) =>
    api.get<{ success: boolean; data: { user: AdminUserItem } }>(`/admin/users/${id}`),

  approveUser: (userId: string) => api.patch(`/admin/users/${userId}/approve`),

  rejectUser: (userId: string, reason: string) =>
    api.patch(`/admin/users/${userId}/reject`, { reason }),

  suspendUser: (userId: string, reason?: string) =>
    api.patch(`/admin/users/${userId}/suspend`, { reason: reason || 'Administrative suspension' }),

  reactivateUser: (userId: string) => api.patch(`/admin/users/${userId}/reactivate`),

  changeUserRole: (userId: string, role: string, reason: string) =>
    api.patch<{ success: boolean; data: { user: AdminUserItem } }>(
      `/admin/users/${userId}/role`,
      { role, reason }
    ),

  getAuditLogs: (filters: AuditLogFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.action) params.append('action', filters.action);
    if (filters.actor) params.append('actor', filters.actor);
    if (filters.targetUser) params.append('targetUser', filters.targetUser);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    return api.get<{
      success: boolean;
      data: {
        items: AuditLogItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/admin/audit-logs?${params.toString()}`);
  },

  getDashboardStats: () => api.get('/admin/dashboard'),
};
