import { Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import ReferralRequest from '../models/ReferralRequest';
import Job from '../models/Job';
import User from '../models/User';
import notificationService from '../services/notificationService';
import fs from 'fs';
import path from 'path';
import { storageService } from '../services/storage';
import { createError } from '../middleware/errorHandler';
import {
  createReferralRequestSchema,
  updateReferralStatusSchema,
} from '../validators/referral';

export class ReferralsController {
  /**
   * 1. POST /api/v1/referrals
   * Creates a new referral request for an open job listing with referralAvailable = true.
   */
  async createReferralRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;

      const validated = createReferralRequestSchema.parse(req.body);

      const job = await Job.findById(validated.jobId);
      if (!job) {
        throw createError('Job listing not found.', 404, 'NOT_FOUND');
      }

      if (job.status !== 'open') {
        throw createError('Cannot request a referral for a closed job listing.', 400, 'JOB_NOT_OPEN');
      }

      if (!job.referralAvailable) {
        throw createError('Referrals are not available for this job listing.', 400, 'REFERRALS_NOT_AVAILABLE');
      }

      if (job.postedBy.toString() === currentUserId.toString()) {
        throw createError('You cannot request a referral for a job you posted.', 400, 'SELF_REFERRAL_FORBIDDEN');
      }

      // Verify applicant account is active
      const applicantUser = await User.findById(currentUserId);
      if (!applicantUser || applicantUser.accountStatus !== 'active') {
        throw createError('Your account is inactive or suspended.', 403, 'ACCOUNT_SUSPENDED');
      }

      let referralDoc;
      try {
        referralDoc = await ReferralRequest.create({
          job: job._id,
          jobPoster: job.postedBy,
          applicant: currentUserId,
          status: 'pending',
          message: validated.message,
          resumeIncluded: Boolean(validated.resumeIncluded),
        });
      } catch (err: any) {
        if (err.code === 11000) {
          throw createError(
            'You already have an active referral request for this job.',
            409,
            'DUPLICATE_REFERRAL_REQUEST'
          );
        }
        throw err;
      }

      // Post-commit: Authoritative Phase 5B notification creation
      try {
        await notificationService.createNotification({
          recipient: job.postedBy,
          actor: currentUserId,
          type: 'referral_request_received',
          title: 'New Referral Request',
          message: `${applicantUser.name} requested a referral for ${job.title} at ${job.company}.`,
          relatedEntityType: 'referral',
          relatedEntityId: referralDoc._id,
        });
      } catch {
        // Notification idempotency guard catches duplicates; non-blocking for response
      }

      res.status(201).json({
        success: true,
        data: {
          referral: referralDoc,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 2. GET /api/v1/referrals/my-requests
   * Lists referral requests submitted by current user.
   */
  async getMyRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const query: any = { applicant: currentUserId };
      if (req.query.status && typeof req.query.status === 'string') {
        query.status = req.query.status;
      }

      const [total, items] = await Promise.all([
        ReferralRequest.countDocuments(query),
        ReferralRequest.find(query)
          .populate('job', 'title company location jobType workplaceType experienceLevel status')
          .populate('jobPoster', 'name email profilePhotoUrl role company designation')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      res.json({
        success: true,
        data: {
          items,
          total,
          page,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 3. GET /api/v1/referrals/received
   * Lists referral requests received by current user (as job poster or admin).
   */
  async getReceivedRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const isAdmin = req.user!.role === 'admin';
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const query: any = {};
      if (!isAdmin) {
        query.jobPoster = currentUserId;
      }
      if (req.query.jobId && mongoose.isValidObjectId(req.query.jobId as string)) {
        query.job = new Types.ObjectId(req.query.jobId as string);
      }
      if (req.query.status && typeof req.query.status === 'string') {
        query.status = req.query.status;
      }

      const [total, items] = await Promise.all([
        ReferralRequest.countDocuments(query),
        ReferralRequest.find(query)
          .populate('job', 'title company location jobType workplaceType status')
          .populate('applicant', 'name email profilePhotoUrl role department batch company designation resume')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      res.json({
        success: true,
        data: {
          items,
          total,
          page,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 4. GET /api/v1/referrals/:id
   * Retrieves detail of a single referral request (applicant, poster, or admin).
   */
  async getReferralById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const isAdmin = req.user!.role === 'admin';
      const { id } = req.params;

      if (!id || !mongoose.isValidObjectId(id)) {
        throw createError('Referral request not found.', 404, 'NOT_FOUND');
      }

      const referral = await ReferralRequest.findById(id)
        .populate('job', 'title company location jobType workplaceType status')
        .populate('jobPoster', 'name email profilePhotoUrl role company designation')
        .populate('applicant', 'name email profilePhotoUrl role department batch company designation resume');

      if (!referral) {
        throw createError('Referral request not found.', 404, 'NOT_FOUND');
      }

      const isApplicant = referral.applicant && (referral.applicant as any)._id?.toString() === currentUserId.toString();
      const isPoster = referral.jobPoster && (referral.jobPoster as any)._id?.toString() === currentUserId.toString();

      if (!isApplicant && !isPoster && !isAdmin) {
        // Existence hiding: return canonical 404
        throw createError('Referral request not found.', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data: {
          referral,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 5. PATCH /api/v1/referrals/:id/status
   * Poster accepts or declines a referral request. Uses atomic transition to prevent race conditions.
   */
  async updateReferralStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const isAdmin = req.user!.role === 'admin';
      const { id } = req.params;

      if (!id || !mongoose.isValidObjectId(id)) {
        throw createError('Referral request not found.', 404, 'NOT_FOUND');
      }

      const validated = updateReferralStatusSchema.parse(req.body);

      const filter: any = {
        _id: id,
        status: 'pending',
      };
      if (!isAdmin) {
        filter.jobPoster = currentUserId;
      }

      const updateDoc: any = {
        $set: {
          status: validated.status,
        },
      };
      if (validated.responseNote !== undefined) {
        updateDoc.$set.responseNote = validated.responseNote;
      }

      const updated = await ReferralRequest.findOneAndUpdate(filter, updateDoc, { new: true })
        .populate('job', 'title company')
        .populate('applicant', 'name email')
        .populate('jobPoster', 'name email');

      if (!updated) {
        const existing = await ReferralRequest.findById(id);
        if (!existing) {
          throw createError('Referral request not found.', 404, 'NOT_FOUND');
        }
        if (!isAdmin && existing.jobPoster.toString() !== currentUserId.toString()) {
          throw createError('Referral request not found.', 404, 'NOT_FOUND');
        }
        throw createError(
          'Referral request cannot be updated in its current state.',
          400,
          'INVALID_STATUS_TRANSITION'
        );
      }

      // Post-commit notification
      try {
        const notifType =
          validated.status === 'accepted'
            ? 'referral_request_accepted'
            : 'referral_request_rejected';
        const jobTitle = (updated.job as any)?.title || 'the job listing';
        const jobCompany = (updated.job as any)?.company ? ` at ${(updated.job as any).company}` : '';
        const actionWord = validated.status === 'accepted' ? 'accepted' : 'declined';
        const applicantId = (updated.applicant as any)?._id || updated.applicant;

        await notificationService.createNotification({
          recipient: applicantId,
          actor: currentUserId,
          type: notifType,
          title: `Referral Request ${validated.status === 'accepted' ? 'Accepted' : 'Declined'}`,
          message: `${req.user!.name} has ${actionWord} your referral request for ${jobTitle}${jobCompany}.`,
          relatedEntityType: 'referral',
          relatedEntityId: updated._id,
        });
      } catch {
        // Non-blocking notification emission
      }

      res.json({
        success: true,
        data: {
          referral: updated,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 6. PATCH /api/v1/referrals/:id/withdraw
   * Applicant withdraws their pending referral request.
   */
  async withdrawReferral(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!._id;
      const { id } = req.params;

      if (!id || !mongoose.isValidObjectId(id)) {
        throw createError('Referral request not found.', 404, 'NOT_FOUND');
      }

      const updated = await ReferralRequest.findOneAndUpdate(
        {
          _id: id,
          applicant: currentUserId,
          status: 'pending',
        },
        {
          $set: { status: 'withdrawn' },
        },
        { new: true }
      );

      if (!updated) {
        const existing = await ReferralRequest.findById(id);
        if (!existing || existing.applicant.toString() !== currentUserId.toString()) {
          throw createError('Referral request not found.', 404, 'NOT_FOUND');
        }
        throw createError(
          'Only pending referral requests can be withdrawn.',
          400,
          'INVALID_STATUS_TRANSITION'
        );
      }

      res.json({
        success: true,
        data: {
          referral: updated,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * 7. GET /api/v1/referrals/:referralRequestId/resume
   * Dedicated resume download endpoint for job posters evaluating candidate referral requests.
   * Separate authorization pipeline from Phase 5C's /users/:id/resume.
   */
  async handleReferralResumeDownload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sendNotFound = () => {
        res.status(404).json({
          success: false,
          error: { code: 'RESUME_NOT_FOUND', message: 'Resume not found.' },
        });
      };

      const currentUserId = req.user!._id;
      const isAdmin = req.user!.role === 'admin';
      const { referralRequestId } = req.params;

      if (!referralRequestId || !mongoose.isValidObjectId(referralRequestId)) {
        sendNotFound();
        return;
      }

      const referral = await ReferralRequest.findById(referralRequestId);
      if (!referral) {
        sendNotFound();
        return;
      }

      // Authorization check: Must be the designated jobPoster or Admin
      const isPoster = referral.jobPoster.toString() === currentUserId.toString();
      if (!isPoster && !isAdmin) {
        sendNotFound();
        return;
      }

      // Status check: Must be pending or accepted
      if (referral.status !== 'pending' && referral.status !== 'accepted') {
        sendNotFound();
        return;
      }

      // Consent check: resumeIncluded must be true
      if (!referral.resumeIncluded) {
        sendNotFound();
        return;
      }

      // Target applicant account status check
      const applicantUser = await User.findById(referral.applicant).select('+resume.storagePath');
      if (!applicantUser || applicantUser.accountStatus !== 'active') {
        sendNotFound();
        return;
      }

      if (!applicantUser.resume || !applicantUser.resume.storagePath) {
        sendNotFound();
        return;
      }

      let filePath: string;
      try {
        filePath = storageService.getPrivateFilePath(applicantUser.resume.storagePath);
      } catch {
        sendNotFound();
        return;
      }

      if (!fs.existsSync(filePath)) {
        sendNotFound();
        return;
      }

      const ext = path.extname(applicantUser.resume.originalName) || '.pdf';
      const safeBaseName = applicantUser.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const downloadFilename = `${safeBaseName}_resume${ext}`;

      res.setHeader('Content-Type', applicantUser.resume.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }
}

export const referralsController = new ReferralsController();
export default referralsController;
