import { z } from 'zod';

const educationItemSchema = z.object({
  institution: z.string().trim().min(1, 'Institution is required.'),
  degree: z.string().trim().min(1, 'Degree is required.'),
  field: z.string().trim().min(1, 'Field of study is required.'),
  startYear: z.number().int().min(1950).max(2100),
  endYear: z.number().int().min(1950).max(2100).optional(),
});

const experienceItemSchema = z.object({
  company: z.string().trim().min(1, 'Company is required.'),
  title: z.string().trim().min(1, 'Job title is required.'),
  startDate: z.string().trim().min(1, 'Start date is required.'),
  endDate: z.string().trim().optional(),
  description: z.string().trim().max(1000).optional(),
});

export const updateProfileSchema = z.object({
  bio: z.string().trim().max(1000, 'Bio must be under 1000 characters.').optional(),
  location: z.string().trim().max(100, 'Location must be under 100 characters.').optional(),
  skills: z.array(z.string().trim().min(1)).max(50).optional(),
  education: z.array(educationItemSchema).max(20).optional(),
  links: z.record(z.string()).optional(),
  
  // Alumni specific fields
  company: z.string().trim().max(100).optional(),
  designation: z.string().trim().max(100).optional(),
  experience: z.array(experienceItemSchema).max(20).optional(),
  mentorshipEnabled: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
