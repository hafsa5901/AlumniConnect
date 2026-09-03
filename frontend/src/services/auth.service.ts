import api from './api';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'student' | 'alumni';
  department: string;
  batch: string;
  studentId?: string;
  alumniId?: string;
  // Alumni proof fields (for non-institutional email)
  graduationYear?: string;
  degree?: string;
  proofNote?: string;
}

export const authService = {
  login: (payload: LoginPayload) =>
    api.post('/auth/login', payload),

  register: (payload: FormData | RegisterPayload) =>
    api.post('/auth/register', payload, {
      headers: payload instanceof FormData
        ? { 'Content-Type': 'multipart/form-data' }
        : undefined,
    }),

  logout: () => api.post('/auth/logout'),

  refresh: () => api.post('/auth/refresh'),

  me: () => api.get('/auth/me'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),

  verifyEmail: (token: string) =>
    api.post('/auth/verify-email', { token }),
};
