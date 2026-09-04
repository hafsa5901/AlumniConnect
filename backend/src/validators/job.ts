import { z } from 'zod';

const httpUrlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export const createJobSchema = z.object({
  title: z
    .string({ required_error: 'Job title is required' })
    .trim()
    .min(2, 'Job title must be at least 2 characters')
    .max(200, 'Job title cannot exceed 200 characters'),
  company: z
    .string({ required_error: 'Company name is required' })
    .trim()
    .min(2, 'Company name must be at least 2 characters')
    .max(200, 'Company name cannot exceed 200 characters'),
  location: z
    .string({ required_error: 'Location is required' })
    .trim()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location cannot exceed 200 characters'),
  jobType: z.enum(['full_time', 'part_time', 'internship', 'contract'], {
    errorMap: () => ({ message: 'Job type must be full_time, part_time, internship, or contract' }),
  }),
  workplaceType: z.enum(['remote', 'hybrid', 'onsite'], {
    errorMap: () => ({ message: 'Workplace type must be remote, hybrid, or onsite' }),
  }),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead'], {
    errorMap: () => ({ message: 'Experience level must be entry, mid, senior, or lead' }),
  }),
  description: z
    .string({ required_error: 'Job description is required' })
    .trim()
    .min(10, 'Job description must be at least 10 characters')
    .max(10000, 'Job description cannot exceed 10,000 characters'),
  requirements: z
    .array(z.string().trim().min(1, 'Requirement cannot be empty'))
    .min(1, 'At least one requirement is required'),
  applicationUrl: z
    .string({ required_error: 'Application URL is required' })
    .trim()
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && httpUrlRegex.test(val);
        } catch {
          return false;
        }
      },
      {
        message: 'Application URL must be a valid http or https URL (e.g. https://company.com/apply)',
      }
    ),
  applicationDeadline: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid deadline date format' })
    .optional()
    .nullable(),
  referralAvailable: z.boolean().optional().default(false),
});

export const updateJobSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Job title must be at least 2 characters')
    .max(200, 'Job title cannot exceed 200 characters')
    .optional(),
  company: z
    .string()
    .trim()
    .min(2, 'Company name must be at least 2 characters')
    .max(200, 'Company name cannot exceed 200 characters')
    .optional(),
  location: z
    .string()
    .trim()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location cannot exceed 200 characters')
    .optional(),
  jobType: z
    .enum(['full_time', 'part_time', 'internship', 'contract'], {
      errorMap: () => ({ message: 'Job type must be full_time, part_time, internship, or contract' }),
    })
    .optional(),
  workplaceType: z
    .enum(['remote', 'hybrid', 'onsite'], {
      errorMap: () => ({ message: 'Workplace type must be remote, hybrid, or onsite' }),
    })
    .optional(),
  experienceLevel: z
    .enum(['entry', 'mid', 'senior', 'lead'], {
      errorMap: () => ({ message: 'Experience level must be entry, mid, senior, or lead' }),
    })
    .optional(),
  description: z
    .string()
    .trim()
    .min(10, 'Job description must be at least 10 characters')
    .max(10000, 'Job description cannot exceed 10,000 characters')
    .optional(),
  requirements: z
    .array(z.string().trim().min(1, 'Requirement cannot be empty'))
    .min(1, 'At least one requirement is required')
    .optional(),
  applicationUrl: z
    .string()
    .trim()
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && httpUrlRegex.test(val);
        } catch {
          return false;
        }
      },
      {
        message: 'Application URL must be a valid http or https URL (e.g. https://company.com/apply)',
      }
    )
    .optional(),
  applicationDeadline: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid deadline date format' })
    .optional()
    .nullable(),
  status: z
    .enum(['open', 'closed'], {
      errorMap: () => ({ message: 'Status must be open or closed' }),
    })
    .optional(),
  referralAvailable: z.boolean().optional(),
});
