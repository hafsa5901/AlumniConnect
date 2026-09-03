import api from './api';

export interface AdminUserFilters {
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export const adminService = {
  getUsers: (filters: AdminUserFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.role) params.append('role', filters.role);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    return api.get(`/admin/users?${params.toString()}`);
  },

  approveUser: (userId: string) => api.patch(`/admin/users/${userId}/approve`),

  rejectUser: (userId: string, reason: string) =>
    api.patch(`/admin/users/${userId}/reject`, { reason }),

  suspendUser: (userId: string) => api.patch(`/admin/users/${userId}/suspend`),

  reactivateUser: (userId: string) => api.patch(`/admin/users/${userId}/reactivate`),

  getAuditLogs: (page = 1, limit = 20) =>
    api.get(`/admin/audit-logs?page=${page}&limit=${limit}`),

  getDashboardStats: () => api.get('/admin/dashboard'),
};
