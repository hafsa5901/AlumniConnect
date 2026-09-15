import { z } from 'zod';
import mongoose from 'mongoose';

export const submitVerificationRequestSchema = z.object({
  collegeId: z
    .string({ required_error: 'College selection is required.' })
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid college identifier.',
    }),
  note: z.string().trim().max(2000, 'Note must not exceed 2000 characters.').optional(),
});

export const rejectVerificationSchema = z.object({
  reason: z
    .string({ required_error: 'Rejection reason is required.' })
    .trim()
    .min(5, 'Please provide a clear reason (minimum 5 characters).')
    .max(1000, 'Rejection reason must be under 1000 characters.'),
});

export const verificationQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'superseded']).optional(),
  role: z.enum(['student', 'alumni']).optional(),
  collegeId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

export type SubmitVerificationRequestInput = z.infer<typeof submitVerificationRequestSchema>;
export type RejectVerificationInput = z.infer<typeof rejectVerificationSchema>;
