import { z } from 'zod';

export const createEventSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
    description: z.string().trim().min(10, 'Description must be at least 10 characters').max(5000, 'Description cannot exceed 5000 characters'),
    category: z.enum(['webinar', 'reunion', 'workshop', 'career', 'networking'], {
      errorMap: () => ({ message: 'Category must be webinar, reunion, workshop, career, or networking' }),
    }),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid start date format',
    }),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid end date format',
    }),
    locationType: z.enum(['virtual', 'in_person', 'hybrid'], {
      errorMap: () => ({ message: 'Location type must be virtual, in_person, or hybrid' }),
    }),
    venueOrLink: z.string().trim().min(1, 'Venue address or meeting link is required'),
    capacity: z
      .number({ invalid_type_error: 'Capacity must be a number' })
      .int('Capacity must be an integer')
      .positive('Capacity must be greater than 0')
      .optional()
      .nullable(),
    bannerUrl: z.string().url('Invalid banner URL').optional().nullable().or(z.literal('')),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end >= start;
    },
    {
      message: 'End date must be greater than or equal to start date',
      path: ['endDate'],
    }
  );

export const rejectEventSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});
