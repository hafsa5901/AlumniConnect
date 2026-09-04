import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Job, { IJob } from '../models/Job';
import { createJobSchema, updateJobSchema } from '../validators/job';
import { createError } from '../middleware/errorHandler';

const formatPoster = (poster: any) => {
  if (!poster) return null;
  const id = poster._id ? poster._id.toString() : poster.id ? poster.id.toString() : poster.toString();
  if (typeof poster === 'object' && (poster._id || poster.id)) {
    return {
      _id: id,
      id,
      name: poster.name,
      profilePhotoUrl: poster.profilePhotoUrl,
      designation: poster.designation,
      company: poster.company,
      role: poster.role,
      department: poster.department,
    };
  }
  return { _id: id, id };
};

export const jobsController = {
  /**
   * listJobs — GET /api/v1/jobs
   * Visibility rule (§2):
   * - By default, returns status: "open" jobs only.
   * - If mine=true and authenticated: returns caller's jobs (both open and closed).
   * - Admin can pass status=open|closed to query explicitly.
   */
  async listJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        search,
        jobType,
        workplaceType,
        experienceLevel,
        referralAvailable,
        mine,
        status,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string | undefined>;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const query: Record<string, any> = {};

      // Visibility & status filtering
      const isAdmin = req.user?.role === 'admin';
      const isMine = mine === 'true' && req.user?._id;

      if (isMine) {
        query.postedBy = req.user!._id;
        if (status && ['open', 'closed'].includes(status)) {
          query.status = status;
        }
      } else if (isAdmin && status && ['open', 'closed'].includes(status)) {
        query.status = status;
      } else {
        query.status = 'open';
      }

      // Filter by jobType
      if (jobType && ['full_time', 'part_time', 'internship', 'contract'].includes(jobType)) {
        query.jobType = jobType;
      }

      // Filter by workplaceType
      if (workplaceType && ['remote', 'hybrid', 'onsite'].includes(workplaceType)) {
        query.workplaceType = workplaceType;
      }

      // Filter by experienceLevel
      if (experienceLevel && ['entry', 'mid', 'senior', 'lead'].includes(experienceLevel)) {
        query.experienceLevel = experienceLevel;
      }

      // Filter by referralAvailable
      if (referralAvailable === 'true') {
        query.referralAvailable = true;
      }

      // Text search
      if (search && search.trim()) {
        const trimmed = search.trim();
        query.$or = [
          { title: { $regex: trimmed, $options: 'i' } },
          { company: { $regex: trimmed, $options: 'i' } },
          { location: { $regex: trimmed, $options: 'i' } },
          { description: { $regex: trimmed, $options: 'i' } },
        ];
      }

      const total = await Job.countDocuments(query);
      const rawJobs = await Job.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate({
          path: 'postedBy',
          select: '_id name profilePhotoUrl designation company role department',
        });

      const jobs = rawJobs.map((job) => ({
        id: job._id,
        title: job.title,
        company: job.company,
        location: job.location,
        jobType: job.jobType,
        workplaceType: job.workplaceType,
        experienceLevel: job.experienceLevel,
        description: job.description,
        requirements: job.requirements,
        applicationUrl: job.applicationUrl,
        applicationDeadline: job.applicationDeadline,
        status: job.status,
        postedBy: formatPoster(job.postedBy),
        referralAvailable: job.referralAvailable,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      }));

      res.status(200).json({
        success: true,
        data: {
          jobs,
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
   * getJobById — GET /api/v1/jobs/:id
   * Visibility rule (§2 & §3.2):
   * - Open job: visible to all users.
   * - Closed job: visible ONLY to poster or admin. Everyone else gets 404 (not 403).
   */
  async getJobById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(createError('Job not found.', 404, 'NOT_FOUND'));
      }

      const job = await Job.findById(id).populate({
        path: 'postedBy',
        select: '_id name profilePhotoUrl designation company role department',
      });

      if (!job) {
        return next(createError('Job not found.', 404, 'NOT_FOUND'));
      }

      // Visibility check for closed jobs
      if (job.status === 'closed') {
        const userId = req.user?._id?.toString();
        const posterId =
          (job.postedBy as any)?._id?.toString() || job.postedBy.toString();
        const isAdmin = req.user?.role === 'admin';
        const isOwner = userId && userId === posterId;

        if (!isAdmin && !isOwner) {
          // Spec §2 & §3.2: 404, not 403, when hidden
          return next(createError('Job not found.', 404, 'NOT_FOUND'));
        }
      }

      res.status(200).json({
        success: true,
        data: {
          job: {
            id: job._id,
            title: job.title,
            company: job.company,
            location: job.location,
            jobType: job.jobType,
            workplaceType: job.workplaceType,
            experienceLevel: job.experienceLevel,
            description: job.description,
            requirements: job.requirements,
            applicationUrl: job.applicationUrl,
            applicationDeadline: job.applicationDeadline,
            status: job.status,
            postedBy: formatPoster(job.postedBy),
            referralAvailable: job.referralAvailable,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * createJob — POST /api/v1/jobs
   * Gated: requireVerified, requireRole('alumni', 'admin')
   */
  async createJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = createJobSchema.safeParse(req.body);
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
      const job = await Job.create({
        ...data,
        applicationDeadline: data.applicationDeadline ? new Date(data.applicationDeadline) : undefined,
        status: 'open', // Server-set
        postedBy: req.user!._id, // Always server-set
      });

      const populatedJob = await Job.findById(job._id).populate({
        path: 'postedBy',
        select: '_id name profilePhotoUrl designation company role department',
      });

      res.status(201).json({
        success: true,
        data: {
          job: {
            id: populatedJob!._id,
            title: populatedJob!.title,
            company: populatedJob!.company,
            location: populatedJob!.location,
            jobType: populatedJob!.jobType,
            workplaceType: populatedJob!.workplaceType,
            experienceLevel: populatedJob!.experienceLevel,
            description: populatedJob!.description,
            requirements: populatedJob!.requirements,
            applicationUrl: populatedJob!.applicationUrl,
            applicationDeadline: populatedJob!.applicationDeadline,
            status: populatedJob!.status,
            postedBy: formatPoster(populatedJob!.postedBy),
            referralAvailable: populatedJob!.referralAvailable,
            createdAt: populatedJob!.createdAt,
            updatedAt: populatedJob!.updatedAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * updateJob — PATCH /api/v1/jobs/:id
   * Gated: requireVerified, requireRole('alumni', 'admin')
   * Owner or admin only (403 FORBIDDEN_OWNERSHIP otherwise).
   * Cannot edit postedBy.
   */
  async updateJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(createError('Job not found.', 404, 'NOT_FOUND'));
      }

      const job = await Job.findById(id);
      if (!job) {
        return next(createError('Job not found.', 404, 'NOT_FOUND'));
      }

      // Ownership check
      const userId = req.user!._id.toString();
      const posterId = job.postedBy.toString();
      const isAdmin = req.user!.role === 'admin';
      const isOwner = userId === posterId;

      if (!isAdmin && !isOwner) {
        return next(
          createError(
            'You do not have permission to modify this job posting.',
            403,
            'FORBIDDEN_OWNERSHIP'
          )
        );
      }

      const validation = updateJobSchema.safeParse(req.body);
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

      // Apply updates (postedBy cannot be changed)
      if (data.title !== undefined) job.title = data.title;
      if (data.company !== undefined) job.company = data.company;
      if (data.location !== undefined) job.location = data.location;
      if (data.jobType !== undefined) job.jobType = data.jobType;
      if (data.workplaceType !== undefined) job.workplaceType = data.workplaceType;
      if (data.experienceLevel !== undefined) job.experienceLevel = data.experienceLevel;
      if (data.description !== undefined) job.description = data.description;
      if (data.requirements !== undefined) job.requirements = data.requirements;
      if (data.applicationUrl !== undefined) job.applicationUrl = data.applicationUrl;
      if (data.applicationDeadline !== undefined) {
        job.applicationDeadline = data.applicationDeadline ? new Date(data.applicationDeadline) : undefined;
      }
      if (data.status !== undefined) job.status = data.status;
      if (data.referralAvailable !== undefined) job.referralAvailable = data.referralAvailable;

      await job.save();
      const populatedJob = await Job.findById(job._id).populate({
        path: 'postedBy',
        select: '_id name profilePhotoUrl designation company role department',
      });

      res.status(200).json({
        success: true,
        data: {
          job: {
            id: populatedJob!._id,
            title: populatedJob!.title,
            company: populatedJob!.company,
            location: populatedJob!.location,
            jobType: populatedJob!.jobType,
            workplaceType: populatedJob!.workplaceType,
            experienceLevel: populatedJob!.experienceLevel,
            description: populatedJob!.description,
            requirements: populatedJob!.requirements,
            applicationUrl: populatedJob!.applicationUrl,
            applicationDeadline: populatedJob!.applicationDeadline,
            status: populatedJob!.status,
            postedBy: formatPoster(populatedJob!.postedBy),
            referralAvailable: populatedJob!.referralAvailable,
            createdAt: populatedJob!.createdAt,
            updatedAt: populatedJob!.updatedAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * deleteJob — DELETE /api/v1/jobs/:id
   * Gated: requireRole('alumni', 'admin')
   * Owner or admin only (403 FORBIDDEN_OWNERSHIP otherwise).
   */
  async deleteJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(createError('Job not found.', 404, 'NOT_FOUND'));
      }

      const job = await Job.findById(id);
      if (!job) {
        return next(createError('Job not found.', 404, 'NOT_FOUND'));
      }

      // Ownership check
      const userId = req.user!._id.toString();
      const posterId = job.postedBy.toString();
      const isAdmin = req.user!.role === 'admin';
      const isOwner = userId === posterId;

      if (!isAdmin && !isOwner) {
        return next(
          createError(
            'You do not have permission to delete this job posting.',
            403,
            'FORBIDDEN_OWNERSHIP'
          )
        );
      }

      await Job.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        data: {
          message: 'Job posting deleted successfully.',
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
