import { z } from 'zod';

const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const createCollegeSchema = z.object({
  name: z
    .string({ required_error: 'College name is required.' })
    .trim()
    .min(2, 'College name must be at least 2 characters.')
    .max(200, 'College name must be under 200 characters.'),
  code: z
    .string({ required_error: 'College code is required.' })
    .trim()
    .toUpperCase()
    .min(2, 'College code must be at least 2 characters.')
    .max(30, 'College code must be under 30 characters.'),
  domains: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(domainRegex, 'Invalid domain format. Example: college.edu')
    )
    .min(1, 'At least one official email domain is required.'),
  location: z
    .object({
      city: z.string().trim().optional(),
      state: z.string().trim().optional(),
      country: z.string().trim().optional(),
    })
    .optional(),
  website: z.string().trim().url('Website must be a valid URL.').optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const updateCollegeSchema = createCollegeSchema.partial();

export const collegeQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

export type CreateCollegeInput = z.infer<typeof createCollegeSchema>;
export type UpdateCollegeInput = z.infer<typeof updateCollegeSchema>;
