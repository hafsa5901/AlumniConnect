import { z } from 'zod';
import mongoose from 'mongoose';

export const createReferralRequestSchema = z.object({
  jobId: z
    .string({ required_error: 'Job ID is required' })
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid job ID format',
    }),
  message: z
    .string({ required_error: 'Referral message is required' })
    .trim()
    .min(5, 'Message must be at least 5 characters')
    .max(2000, 'Message cannot exceed 2000 characters'),
  resumeIncluded: z.boolean().optional().default(false),
});

export const updateReferralStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected'], {
    errorMap: () => ({ message: 'Status must be accepted or rejected' }),
  }),
  responseNote: z.string().trim().max(2000, 'Response note cannot exceed 2000 characters').optional(),
});
