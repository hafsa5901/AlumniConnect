import { z } from 'zod';
import mongoose from 'mongoose';

export const bulkUserActionSchema = z
  .object({
    action: z.enum(['approve', 'reject', 'suspend', 'reactivate'], {
      errorMap: () => ({ message: 'Action must be one of: approve, reject, suspend, reactivate' }),
    }),
    userIds: z
      .array(
        z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
          message: 'Invalid user ID format',
        }),
        { required_error: 'userIds array is required' }
      )
      .min(1, 'At least one user ID is required')
      .max(50, 'Cannot process more than 50 users in a single bulk request'),
    reason: z
      .string()
      .trim()
      .max(500, 'Reason cannot exceed 500 characters')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.action === 'reject' || data.action === 'suspend') && (!data.reason || !data.reason.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `A reason is required for ${data.action} action`,
        path: ['reason'],
      });
    }
  });

export const analyticsActivityQuerySchema = z.object({
  days: z.preprocess(
    (val) => (val !== undefined ? Number(val) : 30),
    z.number({ invalid_type_error: 'Days must be a valid number' })
      .int('Days must be an integer')
      .min(1, 'Days must be at least 1')
      .max(90, 'Days cannot exceed 90')
  ),
});
