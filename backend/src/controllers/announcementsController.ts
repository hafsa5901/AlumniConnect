import { Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import Announcement, {
  IAnnouncement,
  ANNOUNCEMENT_CATEGORIES,
  AnnouncementCategory,
} from '../models/Announcement';
import AdminAuditLog from '../models/AdminAuditLog';
import { createError } from '../middleware/errorHandler';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from '../validators/announcement';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatAuthor(author: any) {
  if (!author) {
    return {
      _id: undefined,
      id: undefined,
      name: 'AlumniConnect Administration',
      profilePhotoUrl: undefined,
    };
  }
  const id = author._id
    ? author._id.toString()
    : author.id
    ? author.id.toString()
    : typeof author === 'string'
    ? author
    : undefined;

  return {
    _id: id,
    id,
    name: author.name || 'AlumniConnect Administration',
    profilePhotoUrl: author.profilePhotoUrl || undefined,
  };
}

function formatAnnouncement(doc: any, includeContent = true) {
  const item: Record<string, any> = {
    id: doc._id ? doc._id.toString() : doc.id,
    _id: doc._id ? doc._id.toString() : doc.id,
    title: doc.title,
    summary: doc.summary,
    category: doc.category,
    coverImage: doc.coverImage || null,
    author: formatAuthor(doc.author),
    published: doc.published,
    publishedAt: doc.publishedAt || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  if (includeContent) {
    item.content = doc.content;
  }

  return item;
}

export const announcementsController = {
  /**
   * listAnnouncements — GET /api/v1/announcements
   * Gated: Any active authenticated user.
   * Visibility: Hardcoded published: true only. Client query parameters cannot leak drafts.
   */
  async listAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '10', q, category } = req.query;

      // Reject non-primitive query parameters (e.g. category[$ne]=x)
      if (
        (q !== undefined && typeof q !== 'string') ||
        (category !== undefined && typeof category !== 'string') ||
        (page !== undefined && typeof page !== 'string') ||
        (limit !== undefined && typeof limit !== 'string')
      ) {
        return next(createError('Invalid query parameter format.', 400, 'VALIDATION_ERROR'));
      }

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      // Hardcode published: true
      const filter: Record<string, any> = { published: true };

      // Category filter
      if (category && category.trim()) {
        const cat = category.trim();
        if (!ANNOUNCEMENT_CATEGORIES.includes(cat as AnnouncementCategory)) {
          return next(
            createError(
              `Category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(', ')}`,
              400,
              'VALIDATION_ERROR'
            )
          );
        }
        filter.category = cat;
      }

      // Search filter in title, summary, or content
      if (q && q.trim()) {
        const trimmedQ = q.trim().slice(0, 100);
        const safeRegex = new RegExp(escapeRegex(trimmedQ), 'i');
        filter.$or = [{ title: safeRegex }, { summary: safeRegex }, { content: safeRegex }];
      }

      const [total, rawItems] = await Promise.all([
        Announcement.countDocuments(filter),
        Announcement.find(filter)
          .select('_id title summary category coverImage author published publishedAt createdAt updatedAt')
          .sort({ publishedAt: -1, _id: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate('author', '_id name profilePhotoUrl')
          .lean(),
      ]);

      const announcements = rawItems.map((item) => formatAnnouncement(item, false));
      const totalPages = Math.ceil(total / limitNum) || 1;

      res.status(200).json({
        success: true,
        data: {
          announcements,
          items: announcements,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * manageAnnouncements — GET /api/v1/announcements/manage
   * Gated: Admin only.
   * Lists drafts and published items with optional status filter.
   */
  async manageAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '10', q, category, status } = req.query;

      if (
        (q !== undefined && typeof q !== 'string') ||
        (category !== undefined && typeof category !== 'string') ||
        (status !== undefined && typeof status !== 'string') ||
        (page !== undefined && typeof page !== 'string') ||
        (limit !== undefined && typeof limit !== 'string')
      ) {
        return next(createError('Invalid query parameter format.', 400, 'VALIDATION_ERROR'));
      }

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      const filter: Record<string, any> = {};

      if (status === 'draft') {
        filter.published = false;
      } else if (status === 'published') {
        filter.published = true;
      } else if (status && status !== 'all') {
        return next(
          createError("Status filter must be 'all', 'draft', or 'published'.", 400, 'VALIDATION_ERROR')
        );
      }

      if (category && category.trim()) {
        const cat = category.trim();
        if (!ANNOUNCEMENT_CATEGORIES.includes(cat as AnnouncementCategory)) {
          return next(
            createError(
              `Category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(', ')}`,
              400,
              'VALIDATION_ERROR'
            )
          );
        }
        filter.category = cat;
      }

      if (q && q.trim()) {
        const trimmedQ = q.trim().slice(0, 100);
        const safeRegex = new RegExp(escapeRegex(trimmedQ), 'i');
        filter.$or = [{ title: safeRegex }, { summary: safeRegex }, { content: safeRegex }];
      }

      const [total, rawItems] = await Promise.all([
        Announcement.countDocuments(filter),
        Announcement.find(filter)
          .select('_id title summary category coverImage author published publishedAt createdAt updatedAt')
          .sort({ updatedAt: -1, _id: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate('author', '_id name profilePhotoUrl')
          .lean(),
      ]);

      const announcements = rawItems.map((item) => formatAnnouncement(item, false));
      const totalPages = Math.ceil(total / limitNum) || 1;

      res.status(200).json({
        success: true,
        data: {
          announcements,
          items: announcements,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * getAnnouncementById — GET /api/v1/announcements/:id
   * Ordinary users receive published items only. Unpublished or nonexistent return identical 404.
   * Admins can read drafts.
   */
  async getAnnouncementById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || !mongoose.isValidObjectId(id)) {
        return next(createError('Announcement not found.', 404, 'NOT_FOUND'));
      }

      const announcement = await Announcement.findById(id).populate(
        'author',
        '_id name profilePhotoUrl'
      );

      if (!announcement) {
        return next(createError('Announcement not found.', 404, 'NOT_FOUND'));
      }

      const isAdmin = req.user?.role === 'admin';
      if (!announcement.published && !isAdmin) {
        return next(createError('Announcement not found.', 404, 'NOT_FOUND'));
      }

      res.status(200).json({
        success: true,
        data: {
          announcement: formatAnnouncement(announcement, true),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * createAnnouncement — POST /api/v1/announcements
   * Gated: Admin only.
   */
  async createAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = createAnnouncementSchema.safeParse(req.body);
      if (!validation.success) {
        return next(
          createError(
            validation.error.errors.map((e) => e.message).join(', '),
            400,
            'VALIDATION_ERROR'
          )
        );
      }

      const data = validation.data;
      const isPublished = Boolean(data.published);
      const publishedAt = isPublished ? new Date() : null;

      const announcement = await Announcement.create({
        title: data.title,
        summary: data.summary,
        content: data.content,
        category: data.category,
        coverImage: data.coverImage,
        author: req.user!._id,
        published: isPublished,
        publishedAt,
      });

      // Audit Log
      await AdminAuditLog.create({
        admin: req.user!._id,
        action: 'announcement.create',
        targetType: 'announcement',
        targetId: announcement._id,
        metadata: {
          title: announcement.title,
          category: announcement.category,
          published: announcement.published,
        },
      });

      const populated = await Announcement.findById(announcement._id).populate(
        'author',
        '_id name profilePhotoUrl'
      );

      res.status(201).json({
        success: true,
        data: {
          announcement: formatAnnouncement(populated, true),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * updateAnnouncement — PATCH /api/v1/announcements/:id
   * Gated: Admin only.
   */
  async updateAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || !mongoose.isValidObjectId(id)) {
        return next(createError('Announcement not found.', 404, 'NOT_FOUND'));
      }

      const validation = updateAnnouncementSchema.safeParse(req.body);
      if (!validation.success) {
        return next(
          createError(
            validation.error.errors.map((e) => e.message).join(', '),
            400,
            'VALIDATION_ERROR'
          )
        );
      }

      const existing = await Announcement.findById(id);
      if (!existing) {
        return next(createError('Announcement not found.', 404, 'NOT_FOUND'));
      }

      const data = validation.data;
      let auditAction:
        | 'announcement.update'
        | 'announcement.publish'
        | 'announcement.unpublish' = 'announcement.update';

      const updateFields: Record<string, any> = {};

      if (data.title !== undefined) updateFields.title = data.title;
      if (data.summary !== undefined) updateFields.summary = data.summary;
      if (data.content !== undefined) updateFields.content = data.content;
      if (data.category !== undefined) updateFields.category = data.category;
      if (data.coverImage !== undefined) updateFields.coverImage = data.coverImage;

      // Handle publish transition
      if (data.published !== undefined) {
        if (data.published === true && !existing.published) {
          updateFields.published = true;
          updateFields.publishedAt = new Date();
          auditAction = 'announcement.publish';
        } else if (data.published === false && existing.published) {
          updateFields.published = false;
          // Unpublishing: keep or clear publishedAt; default: new publishedAt on next transition
          auditAction = 'announcement.unpublish';
        } else {
          updateFields.published = data.published;
        }
      }

      const updated = await Announcement.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true }
      ).populate('author', '_id name profilePhotoUrl');

      if (!updated) {
        return next(createError('Announcement not found.', 404, 'NOT_FOUND'));
      }

      // Audit Log
      await AdminAuditLog.create({
        admin: req.user!._id,
        action: auditAction,
        targetType: 'announcement',
        targetId: updated._id,
        metadata: {
          title: updated.title,
          changedFields: Object.keys(data),
          published: updated.published,
        },
      });

      res.status(200).json({
        success: true,
        data: {
          announcement: formatAnnouncement(updated, true),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * deleteAnnouncement — DELETE /api/v1/announcements/:id
   * Gated: Admin only.
   */
  async deleteAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || !mongoose.isValidObjectId(id)) {
        return next(createError('Announcement not found.', 404, 'NOT_FOUND'));
      }

      const deleted = await Announcement.findByIdAndDelete(id);
      if (!deleted) {
        return next(createError('Announcement not found.', 404, 'NOT_FOUND'));
      }

      // Audit Log
      await AdminAuditLog.create({
        admin: req.user!._id,
        action: 'announcement.delete',
        targetType: 'announcement',
        targetId: deleted._id,
        metadata: {
          title: deleted.title,
          category: deleted.category,
        },
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Announcement deleted successfully.',
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
