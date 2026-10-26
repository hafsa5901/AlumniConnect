import { z } from 'zod';
import { ANNOUNCEMENT_CATEGORIES } from '../models/Announcement';

/**
 * Strips ASCII control characters while preserving valid newlines (\n, \r) and tabs (\t).
 */
export function sanitizeString(val: string): string {
  return val.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/**
 * Validates HTTPS URLs:
 * - Must start with https://
 * - Max length 2048
 * - Parses with URL constructor
 * - Rejects embedded credentials (user:pass@...)
 * - Rejects javascript:, data:, http:, and other non-https protocols
 */
export function validateHttpsUrl(val: string): boolean {
  if (val.length > 2048) {
    return false;
  }
  try {
    const parsed = new URL(val);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    // Reject embedded credentials
    if (parsed.username || parsed.password) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const httpsUrlSchema = z
  .string()
  .trim()
  .transform(sanitizeString)
  .refine(
    (val) => val === '' || validateHttpsUrl(val),
    {
      message: 'Cover image must be a valid HTTPS URL (max 2048 characters, no embedded credentials)',
    }
  )
  .transform((val) => (val === '' ? undefined : val))
  .optional();

export const createAnnouncementSchema = z
  .object({
    title: z
      .string({ required_error: 'Title is required' })
      .trim()
      .transform(sanitizeString)
      .refine((val) => val.length >= 1, { message: 'Title cannot be empty' })
      .refine((val) => val.length <= 150, { message: 'Title cannot exceed 150 characters' }),
    summary: z
      .string({ required_error: 'Summary is required' })
      .trim()
      .transform(sanitizeString)
      .refine((val) => val.length >= 1, { message: 'Summary cannot be empty' })
      .refine((val) => val.length <= 300, { message: 'Summary cannot exceed 300 characters' }),
    content: z
      .string({ required_error: 'Content is required' })
      .trim()
      .transform(sanitizeString)
      .refine((val) => val.length >= 1, { message: 'Content cannot be empty' })
      .refine((val) => val.length <= 10000, { message: 'Content cannot exceed 10,000 characters' }),
    category: z.enum(ANNOUNCEMENT_CATEGORIES, {
      errorMap: () => ({
        message: `Category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(', ')}`,
      }),
    }),
    coverImage: httpsUrlSchema,
    published: z.boolean().optional().default(false),
  })
  .strict({
    message: 'Unknown fields are not allowed in announcement payload',
  });

export const updateAnnouncementSchema = z
  .object({
    title: z
      .string()
      .trim()
      .transform(sanitizeString)
      .refine((val) => val.length >= 1, { message: 'Title cannot be empty' })
      .refine((val) => val.length <= 150, { message: 'Title cannot exceed 150 characters' })
      .optional(),
    summary: z
      .string()
      .trim()
      .transform(sanitizeString)
      .refine((val) => val.length >= 1, { message: 'Summary cannot be empty' })
      .refine((val) => val.length <= 300, { message: 'Summary cannot exceed 300 characters' })
      .optional(),
    content: z
      .string()
      .trim()
      .transform(sanitizeString)
      .refine((val) => val.length >= 1, { message: 'Content cannot be empty' })
      .refine((val) => val.length <= 10000, { message: 'Content cannot exceed 10,000 characters' })
      .optional(),
    category: z
      .enum(ANNOUNCEMENT_CATEGORIES, {
        errorMap: () => ({
          message: `Category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(', ')}`,
        }),
      })
      .optional(),
    coverImage: z
      .union([httpsUrlSchema, z.null()])
      .transform((val) => (val === null || val === '' ? undefined : val))
      .optional(),
    published: z.boolean().optional(),
  })
  .strict({
    message: 'Unknown fields are not allowed in announcement payload',
  });

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
