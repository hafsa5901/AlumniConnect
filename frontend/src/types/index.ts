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
  college?: any;
  collegeDomainVerified?: boolean;
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

// ── Announcements & News Types ──────────────────────────────────────────────
export const ANNOUNCEMENT_CATEGORIES = [
  'General',
  'Events',
  'Placements',
  'Internships',
  'Workshops',
  'Academic',
  'Important',
] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export interface AnnouncementAuthor {
  _id?: string;
  id?: string;
  name: string;
  profilePhotoUrl?: string;
}

export interface AnnouncementItem {
  id: string;
  _id?: string;
  title: string;
  summary: string;
  content?: string;
  category: AnnouncementCategory;
  coverImage?: string | null;
  author: AnnouncementAuthor;
  published: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AnnouncementListResponse {
  announcements: AnnouncementItem[];
  items: AnnouncementItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pagination: AnnouncementPagination;
}

export interface CreateAnnouncementInput {
  title: string;
  summary: string;
  content: string;
  category: AnnouncementCategory;
  coverImage?: string;
  published?: boolean;
}

export interface UpdateAnnouncementInput {
  title?: string;
  summary?: string;
  content?: string;
  category?: AnnouncementCategory;
  coverImage?: string | null;
  published?: boolean;
}

