import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import MentorshipRequest from '../models/MentorshipRequest';
import notificationService from '../services/notificationService';
import {
  createMentorshipRequestSchema,
  updateMentorshipStatusSchema,
} from '../validators/mentorship';
import { createError } from '../middleware/errorHandler';

const formatUserSafe = (userDoc: any) => {
  if (!userDoc) return null;
  const id = userDoc._id ? userDoc._id.toString() : userDoc.id ? userDoc.id.toString() : userDoc.toString();
  if (typeof userDoc === 'object' && (userDoc._id || userDoc.id)) {
    return {
      _id: id,
      id,
      name: userDoc.name,
      profilePhotoUrl: userDoc.profilePhotoUrl,
      designation: userDoc.designation,
      company: userDoc.company,
      role: userDoc.role,
      department: userDoc.department,
      batch: userDoc.batch,
      skills: userDoc.skills || [],
      location: userDoc.location,
      bio: userDoc.bio,
      verificationStatus: userDoc.verificationStatus,
    };
  }
  return { _id: id, id };
};

export const mentorshipController = {
  /**
   * listMentors — GET /api/v1/mentorship/mentors
   * Filter: §1 eligibility:
   * - role === "alumni"
   * - verificationStatus === "admin_approved"
   * - accountStatus === "active"
   * - mentorshipEnabled === true
   */
  async listMentors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        search,
        department,
        company,
        skills,
        location,
        batch,
        page = '1',
        limit = '12',
      } = req.query as Record<string, string | undefined>;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
      const skip = (pageNum - 1) * limitNum;

      // Strict §1 eligibility filter
      const query: Record<string, any> = {
        role: 'alumni',
        verificationStatus: 'admin_approved',
        accountStatus: 'active',
        mentorshipEnabled: true,
      };

      if (department && department.trim()) {
        query.department = department.trim();
      }

      if (batch && batch.trim()) {
        query.batch = batch.trim();
      }

      if (location && location.trim()) {
        query.location = { $regex: location.trim(), $options: 'i' };
      }

      if (company && company.trim()) {
        query.company = { $regex: company.trim(), $options: 'i' };
      }

      if (skills && skills.trim()) {
        const skillArray = skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (skillArray.length > 0) {
          query.skills = { $in: skillArray };
        }
      }

      if (search && search.trim()) {
        const trimmed = search.trim();
        query.$or = [
          { name: { $regex: trimmed, $options: 'i' } },
          { company: { $regex: trimmed, $options: 'i' } },
          { designation: { $regex: trimmed, $options: 'i' } },
          { department: { $regex: trimmed, $options: 'i' } },
          { skills: { $in: [new RegExp(trimmed, 'i')] } },
        ];
      }

      const total = await User.countDocuments(query);
      const rawMentors = await User.find(query)
        .select(
          '_id name profilePhotoUrl designation company department batch skills location links bio role verificationStatus'
        )
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum);

      // Map request status if caller is a student
      let studentRequestMap: Record<string, string> = {};
      if (req.user?.role === 'student') {
        const mentorIds = rawMentors.map((m) => m._id);
        const requests = await MentorshipRequest.find({
          student: req.user._id,
          mentor: { $in: mentorIds },
        }).sort({ createdAt: -1 });

        for (const r of requests) {
          const mId = r.mentor.toString();
          // Keep the first / most active request status
          if (!studentRequestMap[mId] || r.status === 'pending' || r.status === 'accepted') {
            studentRequestMap[mId] = r.status;
          }
        }
      }

      const mentors = rawMentors.map((mentor) => {
        const formatted = formatUserSafe(mentor);
        const mentorIdStr = mentor._id.toString();
        return {
          ...formatted,
          requestStatus: req.user?.role === 'student' ? studentRequestMap[mentorIdStr] || null : null,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          mentors,
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
   * getMyRequests — GET /api/v1/mentorship/my-requests
   * Gated: Authenticated
   * Students see requests where they are student;
   * Alumni see requests where they are mentor.
   */
  async getMyRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isStudent = req.user?.role === 'student';
      const query = isStudent
        ? { student: req.user!._id }
        : { mentor: req.user!._id };

      const rawRequests = await MentorshipRequest.find(query)
        .sort({ createdAt: -1 })
        .populate({
          path: 'student',
          select: '_id name profilePhotoUrl department batch role email',
        })
        .populate({
          path: 'mentor',
          select: '_id name profilePhotoUrl designation company department batch role skills',
        });

      const requests = rawRequests.map((reqDoc) => {
        const r = reqDoc.toObject();
        return {
          id: r._id,
          student: formatUserSafe(r.student),
          mentor: formatUserSafe(r.mentor),
          status: r.status,
          topic: r.topic,
          message: r.message,
          scheduledDate: r.scheduledDate,
          notes: isStudent ? undefined : r.notes, // Notes are mentor-private
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          requests,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * createRequest — POST /api/v1/mentorship/requests
   * Gated: requireVerified, requireRole('student')
   */
  async createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validation = createMentorshipRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return next(
          createError(
            validation.error.errors.map((e) => e.message).join(', '),
            400,
            'VALIDATION_ERROR'
          )
        );
      }

      const { mentor: mentorId, topic, message, scheduledDate } = validation.data;

      // Self-mentorship check
      if (mentorId === req.user!._id.toString()) {
        return next(
          createError(
            'You cannot request mentorship from yourself.',
            400,
            'SELF_MENTORSHIP'
          )
        );
      }

      // Mentor existence & §1 eligibility check
      const mentor = await User.findById(mentorId);
      if (!mentor) {
        return next(createError('Mentor not found.', 404, 'NOT_FOUND'));
      }

      const isEligible =
        mentor.role === 'alumni' &&
        mentor.verificationStatus === 'admin_approved' &&
        mentor.accountStatus === 'active' &&
        mentor.mentorshipEnabled === true;

      if (!isEligible) {
        return next(
          createError(
            'This user is not eligible for mentorship requests or has not opted in.',
            403,
            'NOT_MENTOR_ELIGIBLE'
          )
        );
      }

      // Duplicate active request check (pending or accepted)
      const existingActive = await MentorshipRequest.findOne({
        student: req.user!._id,
        mentor: mentor._id,
        status: { $in: ['pending', 'accepted'] },
      });

      if (existingActive) {
        return next(
          createError(
            'You already have an active mentorship request with this mentor.',
            409,
            'DUPLICATE_MENTORSHIP_REQUEST'
          )
        );
      }

      const mentorshipRequest = await MentorshipRequest.create({
        student: req.user!._id,
        mentor: mentor._id,
        topic,
        message,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        status: 'pending',
      });

      const populated = await MentorshipRequest.findById(mentorshipRequest._id)
        .populate({
          path: 'student',
          select: '_id name profilePhotoUrl department batch role',
        })
        .populate({
          path: 'mentor',
          select: '_id name profilePhotoUrl designation company department batch role skills',
        });

      // Notification: mentorship_request -> mentor
      await notificationService.createNotification({
        recipient: mentor._id,
        actor: req.user!._id,
        type: 'mentorship_request',
        title: 'New Mentorship Request',
        message: `${req.user!.name} requested 1-on-1 mentorship with you on "${topic}".`,
        relatedEntityType: 'mentorship',
        relatedEntityId: mentorshipRequest._id,
      });

      res.status(201).json({
        success: true,
        data: {
          request: {
            id: populated!._id,
            student: formatUserSafe(populated!.student),
            mentor: formatUserSafe(populated!.mentor),
            status: populated!.status,
            topic: populated!.topic,
            message: populated!.message,
            scheduledDate: populated!.scheduledDate,
            createdAt: populated!.createdAt,
            updatedAt: populated!.updatedAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * updateRequestStatus — PATCH /api/v1/mentorship/requests/:id/status
   * Gated: requireVerified
   * Transitions:
   * - pending -> accepted (mentor only)
   * - pending -> rejected (mentor only)
   * - accepted -> completed (mentor only)
   */
  async updateRequestStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return next(createError('Mentorship request not found.', 404, 'NOT_FOUND'));
      }

      const requestDoc = await MentorshipRequest.findById(id);
      if (!requestDoc) {
        return next(createError('Mentorship request not found.', 404, 'NOT_FOUND'));
      }

      // Student role cannot transition status
      if (req.user?.role === 'student') {
        return next(
          createError(
            'Students cannot modify mentorship request status.',
            403,
            'FORBIDDEN_ROLE'
          )
        );
      }

      // Must be the designated mentor on the request
      if (req.user?._id.toString() !== requestDoc.mentor.toString()) {
        return next(
          createError(
            'Only the designated mentor can update this request status.',
            403,
            'FORBIDDEN_OWNERSHIP'
          )
        );
      }

      const validation = updateMentorshipStatusSchema.safeParse(req.body);
      if (!validation.success) {
        return next(
          createError(
            validation.error.errors.map((e) => e.message).join(', '),
            400,
            'VALIDATION_ERROR'
          )
        );
      }

      const { status: targetStatus, notes, scheduledDate } = validation.data;
      const currentStatus = requestDoc.status;

      // Validate transition table
      const isValidTransition =
        (currentStatus === 'pending' && (targetStatus === 'accepted' || targetStatus === 'rejected')) ||
        (currentStatus === 'accepted' && targetStatus === 'completed');

      if (!isValidTransition) {
        return next(
          createError(
            `Invalid status transition from '${currentStatus}' to '${targetStatus}'.`,
            400,
            'INVALID_STATUS_TRANSITION'
          )
        );
      }

      requestDoc.status = targetStatus;
      if (notes !== undefined) {
        requestDoc.notes = notes.trim();
      }
      if (scheduledDate !== undefined) {
        requestDoc.scheduledDate = scheduledDate ? new Date(scheduledDate) : undefined;
      }

      await requestDoc.save();

      const populated = await MentorshipRequest.findById(requestDoc._id)
        .populate({
          path: 'student',
          select: '_id name profilePhotoUrl department batch role',
        })
        .populate({
          path: 'mentor',
          select: '_id name profilePhotoUrl designation company department batch role skills',
        });

      // Status transition notifications -> student
      if (targetStatus === 'accepted') {
        await notificationService.createNotification({
          recipient: requestDoc.student,
          actor: req.user!._id,
          type: 'mentorship_accepted',
          title: 'Mentorship Request Accepted',
          message: `${req.user!.name} accepted your mentorship request on "${requestDoc.topic}".`,
          relatedEntityType: 'mentorship',
          relatedEntityId: requestDoc._id,
        });
      } else if (targetStatus === 'rejected') {
        await notificationService.createNotification({
          recipient: requestDoc.student,
          actor: req.user!._id,
          type: 'mentorship_rejected',
          title: 'Mentorship Request Declined',
          message: `${req.user!.name} was unable to accept your mentorship request on "${requestDoc.topic}".`,
          relatedEntityType: 'mentorship',
          relatedEntityId: requestDoc._id,
        });
      } else if (targetStatus === 'completed') {
        await notificationService.createNotification({
          recipient: requestDoc.student,
          actor: req.user!._id,
          type: 'mentorship_completed',
          title: 'Mentorship Completed',
          message: `${req.user!.name} marked your mentorship connection on "${requestDoc.topic}" as completed.`,
          relatedEntityType: 'mentorship',
          relatedEntityId: requestDoc._id,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          request: {
            id: populated!._id,
            student: formatUserSafe(populated!.student),
            mentor: formatUserSafe(populated!.mentor),
            status: populated!.status,
            topic: populated!.topic,
            message: populated!.message,
            scheduledDate: populated!.scheduledDate,
            notes: populated!.notes,
            createdAt: populated!.createdAt,
            updatedAt: populated!.updatedAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
