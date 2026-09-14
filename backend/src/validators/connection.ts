import { z } from 'zod';
import mongoose from 'mongoose';

export const createConnectionSchema = z.object({
  recipientId: z
    .string({ required_error: 'Recipient ID is required' })
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Invalid recipient ID format',
    }),
  message: z
    .string()
    .trim()
    .max(500, 'Message cannot exceed 500 characters')
    .optional(),
});

export const updateConnectionStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected'], {
    errorMap: () => ({ message: 'Status must be accepted or rejected' }),
  }),
});
