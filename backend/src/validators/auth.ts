import { z } from 'zod';

// ── Shared field schemas ──────────────────────────────────────────────────────
const emailSchema = z
  .string({ required_error: 'Email is required.' })
  .email('Please enter a valid email address.')
  .toLowerCase()
  .trim();

const passwordSchema = z
  .string({ required_error: 'Password is required.' })
  .min(10, 'Password must be at least 10 characters.')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

// ── Register ─────────────────────────────────────────────────────────────────
export const registerSchema = z
  .object({
    name: z
      .string({ required_error: 'Name is required.' })
      .trim()
      .min(2, 'Name must be at least 2 characters.')
      .max(100, 'Name must be at most 100 characters.'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'Please confirm your password.' }),
    role: z.enum(['student', 'alumni'], {
      required_error: 'Role must be student or alumni.',
      invalid_type_error: 'Role must be student or alumni.',
    }),
    department: z
      .string({ required_error: 'Department is required.' })
      .trim()
      .min(2, 'Department must be at least 2 characters.'),
    batch: z
      .string({ required_error: 'Batch/year is required.' })
      .trim()
      .min(1, 'Batch is required.'),
    institution: z.string().trim().optional(),
    studentId: z.string().trim().optional(),
    alumniId: z.string().trim().optional(),
    // Alumni non-institutional proof fields (optional — validated conditionally below)
    graduationYear: z.string().trim().optional(),
    degree: z.string().trim().optional(),
    proofNote: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// ── Login ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ── Forgot password ────────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// ── Reset password ─────────────────────────────────────────────────────────────
export const resetPasswordSchema = z.object({
  token: z.string({ required_error: 'Reset token is required.' }).min(1),
  password: passwordSchema,
  confirmPassword: z.string({ required_error: 'Please confirm your password.' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

// ── Admin actions ─────────────────────────────────────────────────────────────
export const rejectUserSchema = z.object({
  reason: z
    .string({ required_error: 'Rejection reason is required.' })
    .trim()
    .min(5, 'Please provide a reason (min 5 chars).')
    .max(500, 'Reason must be under 500 characters.'),
});

// ── Validation middleware factory ─────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = result.error.errors.reduce<Record<string, string>>(
        (acc, err) => {
          const field = err.path.join('.');
          acc[field] = err.message;
          return acc;
        },
        {}
      );
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          fields: fieldErrors,
        },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
