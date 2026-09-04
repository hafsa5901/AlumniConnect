import { z } from 'zod';
import mongoose from 'mongoose';

export const createMentorshipRequestSchema = z.object({
  mentor: z
    .string({ required_error: 'Mentor ID is required' })
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid mentor ID format',
    }),
  topic: z
    .string({ required_error: 'Topic is required' })
    .trim()
    .min(2, 'Topic must be at least 2 characters')
    .max(200, 'Topic cannot exceed 200 characters'),
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(5, 'Message must be at least 5 characters')
    .max(3000, 'Message cannot exceed 3000 characters'),
  scheduledDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid scheduled date format' })
    .optional()
    .nullable(),
});

export const updateMentorshipStatusSchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'completed'], {
    errorMap: () => ({ message: 'Status must be pending, accepted, rejected, or completed' }),
  }),
  notes: z.string().trim().max(3000, 'Notes cannot exceed 3000 characters').optional(),
  scheduledDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid scheduled date format' })
    .optional()
    .nullable(),
});
