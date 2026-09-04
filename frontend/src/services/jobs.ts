import api from './api';

export type JobType = 'full_time' | 'part_time' | 'internship' | 'contract';
export type WorkplaceType = 'remote' | 'hybrid' | 'onsite';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead';
export type JobStatus = 'open' | 'closed';

export interface JobPoster {
  _id: string;
  name: string;
  profilePhotoUrl?: string;
  designation?: string;
  company?: string;
  role: string;
  department?: string;
}

export interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  jobType: JobType;
  workplaceType: WorkplaceType;
  experienceLevel: ExperienceLevel;
  description: string;
  requirements: string[];
  applicationUrl: string;
  applicationDeadline?: string;
  status: JobStatus;
  postedBy: JobPoster;
  referralAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JobFilters {
  search?: string;
  jobType?: string;
  workplaceType?: string;
  experienceLevel?: string;
  referralAvailable?: boolean;
  mine?: boolean;
  status?: JobStatus;
  page?: number;
  limit?: number;
}

export interface CreateJobPayload {
  title: string;
  company: string;
  location: string;
  jobType: JobType;
  workplaceType: WorkplaceType;
  experienceLevel: ExperienceLevel;
  description: string;
  requirements: string[];
  applicationUrl: string;
  applicationDeadline?: string | null;
  referralAvailable?: boolean;
}

export interface UpdateJobPayload {
  title?: string;
  company?: string;
  location?: string;
  jobType?: JobType;
  workplaceType?: WorkplaceType;
  experienceLevel?: ExperienceLevel;
  description?: string;
  requirements?: string[];
  applicationUrl?: string;
  applicationDeadline?: string | null;
  status?: JobStatus;
  referralAvailable?: boolean;
}

export const jobsService = {
  listJobs: (filters: JobFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.jobType) params.append('jobType', filters.jobType);
    if (filters.workplaceType) params.append('workplaceType', filters.workplaceType);
    if (filters.experienceLevel) params.append('experienceLevel', filters.experienceLevel);
    if (filters.referralAvailable !== undefined) {
      params.append('referralAvailable', filters.referralAvailable ? 'true' : 'false');
    }
    if (filters.mine) params.append('mine', 'true');
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    return api.get<{
      success: boolean;
      data: {
        jobs: JobItem[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      };
    }>(`/jobs?${params.toString()}`);
  },

  getJobById: (id: string) =>
    api.get<{ success: boolean; data: { job: JobItem } }>(`/jobs/${id}`),

  createJob: (payload: CreateJobPayload) =>
    api.post<{ success: boolean; data: { job: JobItem } }>('/jobs', payload),

  updateJob: (id: string, payload: UpdateJobPayload) =>
    api.patch<{ success: boolean; data: { job: JobItem } }>(`/jobs/${id}`, payload),

  deleteJob: (id: string) =>
    api.delete<{ success: boolean; data: { message: string } }>(`/jobs/${id}`),
};
