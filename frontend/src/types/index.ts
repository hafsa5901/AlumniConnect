export type Role = 'student' | 'alumni' | 'admin';
export type VerificationStatus = 'pending' | 'email_verified' | 'admin_approved' | 'rejected';
export type AccountStatus = 'active' | 'suspended' | 'deactivated';

export interface ResumeMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  institution?: string;
  department?: string;
  batch?: string;
  studentId?: string;
  alumniId?: string;
  profilePhotoUrl?: string;
  resume?: ResumeMetadata | null;
  hasResume?: boolean;
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

export type ReferralStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface ReferralRequestItem {
  _id: string;
  id?: string;
  job: {
    _id: string;
    id?: string;
    title: string;
    company: string;
    location?: string;
    jobType?: string;
    workplaceType?: string;
    experienceLevel?: string;
    status: 'open' | 'closed';
  } | null;
  jobPoster: Partial<User>;
  applicant: Partial<User>;
  status: ReferralStatus;
  message: string;
  responseNote?: string;
  resumeIncluded: boolean;
  createdAt: string;
  updatedAt: string;
}

