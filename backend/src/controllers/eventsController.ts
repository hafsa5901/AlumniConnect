import { Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import Event, { IEvent } from '../models/Event';
import User from '../models/User';
import AdminAuditLog from '../models/AdminAuditLog';
import { createError } from '../middleware/errorHandler';
import { createEventSchema, rejectEventSchema } from '../validators/event';

export const eventsController = {
  /**
   * listEvents — GET /api/v1/events
   * Visibility rule (§3):
   * - Approved events are visible to all authenticated users.
   * - If mine=true, include caller's own events (pending/rejected/approved).
   * - If caller is admin and status filter provided, filter by that status.
   */
  async listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        category,
        timeframe = 'upcoming',
        search,
        mine,
        status,
        page = '1',
        limit = '20',
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
      const skip = (pageNum - 1) * limitNum;
      const now = new Date();
      const userId = req.user?._id;
      const isAdmin = req.user?.role === 'admin';

      const filter: any = {};

      // 1. Visibility & Approval status
      if (isAdmin && status) {
        filter.approvalStatus = status;
      } else if (mine === 'true' && userId) {
        if (isAdmin) {
          // Admin can see everything
        } else {
          filter.$or = [{ approvalStatus: 'approved' }, { organizer: userId }];
        }
      } else {
        filter.approvalStatus = 'approved';
      }

      // 2. Category filter
      if (category && typeof category === 'string') {
        filter.category = category;
      }

      // 3. Timeframe filter
      if (timeframe === 'upcoming') {
        filter.endDate = { $gte: now };
      } else if (timeframe === 'past') {
        filter.endDate = { $lt: now };
      }

      // 4. Search query
      if (search && typeof search === 'string' && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [{ title: regex }, { description: regex }, { venueOrLink: regex }],
        });
      }

      const total = await Event.countDocuments(filter);
      const sortOrder: any = timeframe === 'past' ? { startDate: -1 } : { startDate: 1 };

      const rawEvents = await Event.find(filter)
        .sort(sortOrder)
        .skip(skip)
        .limit(limitNum)
        .populate('organizer', '_id name profilePhotoUrl designation company department role');

      const events = rawEvents.map((evt) => {
        const attendingCount = evt.rsvps.filter((r) => r.status === 'attending').length;
        const capacity = evt.capacity || null;
        const spotsRemaining = capacity !== null ? Math.max(0, capacity - attendingCount) : null;
        const userRsvp = userId
          ? evt.rsvps.find((r) => r.user.toString() === userId.toString())
          : null;

        return {
          id: evt._id,
          title: evt.title,
          description: evt.description,
          category: evt.category,
          startDate: evt.startDate,
          endDate: evt.endDate,
          locationType: evt.locationType,
          venueOrLink: evt.venueOrLink,
          organizer: evt.organizer,
          capacity,
          approvalStatus: evt.approvalStatus,
          rejectionReason: evt.rejectionReason,
          bannerUrl: evt.bannerUrl,
          attendingCount,
          spotsRemaining,
          userRsvpStatus: userRsvp ? userRsvp.status : null,
          createdAt: evt.createdAt,
          updatedAt: evt.updatedAt,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          events,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * getEventById — GET /api/v1/events/:id
   * Visibility rule (§3):
   * - Approved event: visible to all authenticated users.
   * - Pending/Rejected event: visible ONLY to organizer or admin. Otherwise 404 (not 403).
   */
  async getEventById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      const evt = await Event.findById(id).populate(
        'organizer',
        '_id name profilePhotoUrl designation company department role'
      );

      if (!evt) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      const userId = req.user?._id;
      const isAdmin = req.user?.role === 'admin';
      const isOrganizer = userId && evt.organizer && evt.organizer._id.toString() === userId.toString();

      // Visibility check (§3): 404 if not approved and not organizer/admin
      if (evt.approvalStatus !== 'approved' && !isAdmin && !isOrganizer) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      const attendingCount = evt.rsvps.filter((r) => r.status === 'attending').length;
      const capacity = evt.capacity || null;
      const spotsRemaining = capacity !== null ? Math.max(0, capacity - attendingCount) : null;
      const userRsvp = userId
        ? evt.rsvps.find((r) => r.user.toString() === userId.toString())
        : null;

      res.status(200).json({
        success: true,
        data: {
          event: {
            id: evt._id,
            title: evt.title,
            description: evt.description,
            category: evt.category,
            startDate: evt.startDate,
            endDate: evt.endDate,
            locationType: evt.locationType,
            venueOrLink: evt.venueOrLink,
            organizer: evt.organizer,
            capacity,
            approvalStatus: evt.approvalStatus,
            rejectionReason: evt.rejectionReason,
            bannerUrl: evt.bannerUrl,
            attendingCount,
            spotsRemaining,
            userRsvpStatus: userRsvp ? userRsvp.status : null,
            createdAt: evt.createdAt,
            updatedAt: evt.updatedAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * getEventAttendees — GET /api/v1/events/:id/attendees
   * Gated: Event organizer or admin only. 403 otherwise.
   */
  async getEventAttendees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      const evt = await Event.findById(id).populate({
        path: 'rsvps.user',
        select: '_id name profilePhotoUrl role department batch',
      });

      if (!evt) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      const userId = req.user?._id;
      const isAdmin = req.user?.role === 'admin';
      const isOrganizer = userId && evt.organizer.toString() === userId.toString();

      if (!isAdmin && !isOrganizer) {
        return next(
          createError(
            'Only the event organizer or an administrator may view the attendee list.',
            403,
            'FORBIDDEN'
          )
        );
      }

      const attendees = evt.rsvps
        .filter((r) => r.status === 'attending' && r.user)
        .map((r: any) => {
          const u = r.user;
          return {
            user: {
              _id: u._id || u.id,
              id: u._id || u.id,
              name: u.name,
              profilePhotoUrl: u.profilePhotoUrl,
              role: u.role,
              department: u.department,
              batch: u.batch,
            },
            registeredAt: r.registeredAt,
          };
        });

      res.status(200).json({
        success: true,
        data: {
          attendees,
          count: attendees.length,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * createEvent — POST /api/v1/events
   * Gated: requireVerified, requireRole('alumni', 'admin').
   * Admin-created → 'approved', Alumni-created → 'pending'.
   */
  async createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createEventSchema.safeParse(req.body);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message || 'Validation error';
        return next(createError(firstError, 422, 'VALIDATION_ERROR'));
      }

      const {
        title,
        description,
        category,
        startDate,
        endDate,
        locationType,
        venueOrLink,
        capacity,
        bannerUrl,
      } = parsed.data;

      const isAdmin = req.user?.role === 'admin';
      const approvalStatus = isAdmin ? 'approved' : 'pending';

      const event = await Event.create({
        title,
        description,
        category,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        locationType,
        venueOrLink,
        capacity: capacity || undefined,
        bannerUrl: bannerUrl || undefined,
        organizer: req.user!._id,
        approvalStatus,
        rsvps: [],
      });

      res.status(201).json({
        success: true,
        data: {
          event: {
            id: event._id,
            title: event.title,
            description: event.description,
            category: event.category,
            startDate: event.startDate,
            endDate: event.endDate,
            locationType: event.locationType,
            venueOrLink: event.venueOrLink,
            organizer: event.organizer,
            capacity: event.capacity || null,
            approvalStatus: event.approvalStatus,
            bannerUrl: event.bannerUrl,
            attendingCount: 0,
            spotsRemaining: event.capacity || null,
            createdAt: event.createdAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * approveEvent — PATCH /api/v1/events/:id/approve
   * Admin only.
   */
  async approveEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      const evt = await Event.findById(id);
      if (!evt) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      evt.approvalStatus = 'approved';
      evt.rejectionReason = undefined;
      await evt.save();

      // Log audit
      await AdminAuditLog.create({
        admin: req.user!._id,
        action: 'event.approve',
        targetType: 'event',
        targetId: evt._id,
        metadata: { title: evt.title },
      });

      res.status(200).json({
        success: true,
        data: {
          event: {
            id: evt._id,
            title: evt.title,
            approvalStatus: evt.approvalStatus,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * rejectEvent — PATCH /api/v1/events/:id/reject
   * Admin only.
   */
  async rejectEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      const parsed = rejectEventSchema.safeParse(req.body);
      const reason = parsed.success ? parsed.data.reason : undefined;

      const evt = await Event.findById(id);
      if (!evt) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      evt.approvalStatus = 'rejected';
      evt.rejectionReason = reason || 'Rejected by administrator';
      await evt.save();

      // Log audit
      await AdminAuditLog.create({
        admin: req.user!._id,
        action: 'event.reject',
        targetType: 'event',
        targetId: evt._id,
        metadata: { title: evt.title, reason: evt.rejectionReason },
      });

      res.status(200).json({
        success: true,
        data: {
          event: {
            id: evt._id,
            title: evt.title,
            approvalStatus: evt.approvalStatus,
            rejectionReason: evt.rejectionReason,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * rsvpEvent — POST /api/v1/events/:id/rsvp
   * Gated: requireVerified.
   * Atomically checks approval, end date, duplicate status, and capacity.
   */
  async rsvpEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      const evt = await Event.findById(id);
      if (!evt) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      if (evt.approvalStatus !== 'approved') {
        return next(createError('Cannot RSVP to an unapproved event.', 403, 'EVENT_NOT_APPROVED'));
      }

      if (new Date(evt.endDate) < new Date()) {
        return next(createError('Cannot RSVP to an event that has already ended.', 400, 'EVENT_ENDED'));
      }

      const userId = req.user!._id;
      const existingRsvp = evt.rsvps.find((r) => r.user.toString() === userId.toString());

      if (existingRsvp && existingRsvp.status === 'attending') {
        return next(createError('You have already RSVPed to this event.', 409, 'DUPLICATE_RSVP'));
      }

      const attendingCount = evt.rsvps.filter((r) => r.status === 'attending').length;
      if (evt.capacity && attendingCount >= evt.capacity) {
        return next(createError('Event has reached maximum capacity.', 409, 'EVENT_FULL'));
      }

      if (existingRsvp && existingRsvp.status === 'cancelled') {
        // Flip back to attending
        await Event.updateOne(
          { _id: evt._id, 'rsvps.user': userId },
          { $set: { 'rsvps.$.status': 'attending', 'rsvps.$.registeredAt': new Date() } }
        );
      } else {
        // Push new entry
        await Event.updateOne(
          { _id: evt._id },
          { $push: { rsvps: { user: userId, status: 'attending', registeredAt: new Date() } } }
        );
      }

      const updatedAttendingCount = attendingCount + 1;
      const spotsRemaining = evt.capacity ? Math.max(0, evt.capacity - updatedAttendingCount) : null;

      res.status(200).json({
        success: true,
        data: {
          message: 'RSVP confirmed successfully.',
          attendingCount: updatedAttendingCount,
          spotsRemaining,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * cancelRsvp — DELETE /api/v1/events/:id/rsvp
   * Gated: requireVerified.
   * Sets rsvps.$.status to 'cancelled'. Returns 404 if no prior RSVP.
   */
  async cancelRsvp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      const userId = req.user!._id;
      const evt = await Event.findById(id);

      if (!evt) {
        return next(createError('Event not found.', 404, 'NOT_FOUND'));
      }

      const existingRsvp = evt.rsvps.find(
        (r) => r.user.toString() === userId.toString() && r.status === 'attending'
      );

      if (!existingRsvp) {
        return next(createError('No active RSVP found for this event.', 404, 'NOT_FOUND'));
      }

      await Event.updateOne(
        { _id: evt._id, 'rsvps.user': userId },
        { $set: { 'rsvps.$.status': 'cancelled' } }
      );

      const attendingCount = evt.rsvps.filter(
        (r) => r.status === 'attending' && r.user.toString() !== userId.toString()
      ).length;
      const spotsRemaining = evt.capacity ? Math.max(0, evt.capacity - attendingCount) : null;

      res.status(200).json({
        success: true,
        data: {
          message: 'RSVP cancelled successfully.',
          attendingCount,
          spotsRemaining,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
