export type Role = 'student' | 'alumni' | 'admin';
export type VerificationStatus = 'pending' | 'email_verified' | 'admin_approved' | 'rejected';
export type AccountStatus = 'active' | 'suspended' | 'deactivated';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  institution?: string;
  department?: string;
  batch?: string;
  studentId?: string;
  alumniId?: string;
  profilePhotoUrl?: string;
  bio?: string;
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  company?: string;
  designation?: string;
  location?: string;
  links: Record<string, string>;
  mentorshipEnabled?: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  endYear?: number;
}

export interface ExperienceEntry {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
