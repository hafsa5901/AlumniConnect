import api from './api';

export interface AlumniListItem {
  id: string;
  name: string;
  profilePhotoUrl?: string;
  designation?: string;
  company?: string;
  department?: string;
  batch?: string;
  skills: string[];
  location?: string;
  mentorshipEnabled: boolean;
}

export interface AlumniDetailItem extends AlumniListItem {
  bio?: string;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startYear: number;
    endYear?: number;
  }>;
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
    description?: string;
  }>;
  links: Record<string, string>;
  joinedDate?: string;
}

export interface AlumniQueryFilters {
  search?: string;
  department?: string;
  batch?: string;
  company?: string;
  skills?: string;
  location?: string;
  page?: number;
  limit?: number;
}

export const alumniService = {
  listAlumni: (filters: AlumniQueryFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.department) params.append('department', filters.department);
    if (filters.batch) params.append('batch', filters.batch);
    if (filters.company) params.append('company', filters.company);
    if (filters.skills) params.append('skills', filters.skills);
    if (filters.location) params.append('location', filters.location);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    return api.get<{
      success: boolean;
      data: {
        alumni: AlumniListItem[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      };
    }>(`/alumni?${params.toString()}`);
  },

  getAlumniById: (id: string) =>
    api.get<{ success: boolean; data: { alumni: AlumniDetailItem } }>(`/alumni/${id}`),
};
