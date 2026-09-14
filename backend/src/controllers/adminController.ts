import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler, createError } from '../middleware/errorHandler';
import * as authService from '../services/authService';
import AdminAuditLog from '../models/AdminAuditLog';
import User, { IUser, SAFE_USER_FIELDS } from '../models/User';
import MentorshipRequest from '../models/MentorshipRequest';
import ReferralRequest from '../models/ReferralRequest';
import ConnectionRequest from '../models/ConnectionRequest';
import Job from '../models/Job';
import Event from '../models/Event';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { paginate, paginatedResponse } from '../utils/helpers';
import {
  bulkUserActionSchema,
  analyticsActivityQuerySchema,
} from '../validators/admin';

// Concurrency mutex to ensure atomic last-active-admin invariant checks
let adminActionMutex: Promise<any> = Promise.resolve();

async function runAdminProtectedAction<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  const currentLock = adminActionMutex;
  adminActionMutex = currentLock.then(() => nextLock, () => nextLock);

  await currentLock;
  try {
    return await fn();
  } finally {
    release!();
  }
}

// ── GET /api/v1/admin/users ───────────────────────────────────────────────────
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const {
    status,
    role,
    verificationStatus,
    department,
    batch,
    company,
    institution,
    search,
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const { skip, limit: lim, page: pg } = paginate(+page, +limit);

  const filter: Record<string, any> = {};

  if (verificationStatus) {
    filter.verificationStatus = verificationStatus;
  }

  if (status) {
    if (['active', 'suspended', 'deactivated'].includes(status)) {
      filter.accountStatus = status;
    } else if (['pending', 'email_verified', 'admin_approved', 'rejected'].includes(status)) {
      filter.verificationStatus = status;
    }
  }

  if (role && ['student', 'alumni', 'admin'].includes(role)) {
    filter.role = role;
  }

  if (department && department.trim()) {
    filter.department = department.trim();
  }

  if (batch && batch.trim()) {
    filter.batch = batch.trim();
  }

  if (company && company.trim()) {
    filter.company = { $regex: company.trim(), $options: 'i' };
  }

  if (institution && institution.trim()) {
    filter.institution = { $regex: institution.trim(), $options: 'i' };
  }

  if (search && search.trim()) {
    const trimmed = search.trim();
    filter.$or = [
      { name: { $regex: trimmed, $options: 'i' } },
      { email: { $regex: trimmed, $options: 'i' } },
      { company: { $regex: trimmed, $options: 'i' } },
      { institution: { $regex: trimmed, $options: 'i' } },
      { department: { $regex: trimmed, $options: 'i' } },
      { batch: { $regex: trimmed, $options: 'i' } },
    ];
  }

  const ADMIN_SAFE_FIELDS =
    '-passwordHash -verificationTokenHash -verificationTokenExpires -resetTokenHash -resetTokenExpires -refreshTokenHash';

  const [items, total] = await Promise.all([
    User.find(filter)
      .select(ADMIN_SAFE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, data: paginatedResponse(items, total, pg, lim) });
});

// ── GET /api/v1/admin/users/:id ───────────────────────────────────────────────
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  const ADMIN_SAFE_FIELDS =
    '-passwordHash -verificationTokenHash -verificationTokenExpires -resetTokenHash -resetTokenExpires -refreshTokenHash';

  const user = await User.findById(userId).select(ADMIN_SAFE_FIELDS);

  if (!user) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  res.json({ success: true, data: { user } });
});

// ── PATCH /api/v1/admin/users/:id/approve ────────────────────────────────────
export const approveUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  const user = await authService.approveUser(userId);

  await AdminAuditLog.create({
    admin: req.user!._id,
    action: 'user.approve',
    targetType: 'user',
    targetId: user._id,
    metadata: { previousStatus: user.verificationStatus },
  });

  res.json({ success: true, data: { user } });
});

// ── PATCH /api/v1/admin/users/:id/reject ─────────────────────────────────────
export const rejectUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  const { reason } = req.body;
  const user = await authService.rejectUser(userId, reason);

  await AdminAuditLog.create({
    admin: req.user!._id,
    action: 'user.reject',
    targetType: 'user',
    targetId: user._id,
    metadata: { reason },
  });

  res.json({ success: true, data: { user } });
});

// ── PATCH /api/v1/admin/users/:id/suspend ────────────────────────────────────
export const suspendUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw createError('A reason is required to suspend a user account.', 400, 'VALIDATION_ERROR');
  }

  // Self-action check
  if (req.user!._id.toString() === userId) {
    throw createError('You cannot suspend your own account.', 403, 'SELF_ACTION_FORBIDDEN');
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  // Last-active-admin protection
  if (targetUser.role === 'admin' && targetUser.accountStatus === 'active') {
    const activeAdminsCount = await User.countDocuments({
      role: 'admin',
      accountStatus: 'active',
      _id: { $ne: targetUser._id },
    });
    if (activeAdminsCount === 0) {
      throw createError(
        'Cannot suspend the last active administrator account.',
        403,
        'LAST_ADMIN_PROTECTED'
      );
    }
  }

  const user = await authService.suspendUser(userId);

  await AdminAuditLog.create({
    admin: req.user!._id,
    action: 'user.suspend',
    targetType: 'user',
    targetId: user._id,
    metadata: { reason: reason.trim() },
  });

  res.json({ success: true, data: { user } });
});

// ── PATCH /api/v1/admin/users/:id/reactivate ─────────────────────────────────
export const reactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  const user = await authService.reactivateUser(userId);

  await AdminAuditLog.create({
    admin: req.user!._id,
    action: 'user.reactivate',
    targetType: 'user',
    targetId: user._id,
    metadata: {},
  });

  res.json({ success: true, data: { user } });
});

// ── PATCH /api/v1/admin/users/:id/role ───────────────────────────────────────
export const changeUserRole = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  const { role, reason } = req.body;

  if (!role || !['student', 'alumni', 'admin'].includes(role)) {
    throw createError('Invalid role specified.', 400, 'INVALID_ROLE');
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw createError('Reason is required for changing user role.', 400, 'VALIDATION_ERROR');
  }

  // Self-action check
  if (req.user!._id.toString() === userId) {
    throw createError('You cannot change your own role.', 403, 'SELF_ACTION_FORBIDDEN');
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  // Last-active-admin protection
  if (targetUser.role === 'admin' && targetUser.accountStatus === 'active' && role !== 'admin') {
    const activeAdminsCount = await User.countDocuments({
      role: 'admin',
      accountStatus: 'active',
      _id: { $ne: targetUser._id },
    });
    if (activeAdminsCount === 0) {
      throw createError(
        'Cannot demote the last active administrator account.',
        403,
        'LAST_ADMIN_PROTECTED'
      );
    }
  }

  const previousRole = targetUser.role;
  const previousVerificationStatus = targetUser.verificationStatus;

  targetUser.role = role;
  if (role === 'admin') {
    targetUser.verificationStatus = 'admin_approved';
  } else {
    targetUser.verificationStatus = 'pending';
  }

  await targetUser.save();

  await AdminAuditLog.create({
    admin: req.user!._id,
    action: 'user.role_change',
    targetType: 'user',
    targetId: targetUser._id,
    metadata: {
      previousRole,
      newRole: role,
      previousVerificationStatus,
      newVerificationStatus: targetUser.verificationStatus,
      reason: reason.trim(),
    },
  });

  const updatedUser = await User.findById(userId).select(SAFE_USER_FIELDS);

  res.json({ success: true, data: { user: updatedUser } });
});

// ── GET /api/v1/admin/audit-logs ─────────────────────────────────────────────
export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const {
    action,
    actor,
    targetUser,
    startDate,
    endDate,
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const { skip, limit: lim, page: pg } = paginate(+page, +limit);

  const query: Record<string, any> = {};

  if (action && action.trim()) {
    query.action = action.trim();
  }

  if (actor && mongoose.Types.ObjectId.isValid(actor.trim())) {
    query.admin = new mongoose.Types.ObjectId(actor.trim());
  }

  if (targetUser && mongoose.Types.ObjectId.isValid(targetUser.trim())) {
    query.targetId = new mongoose.Types.ObjectId(targetUser.trim());
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate && !isNaN(Date.parse(startDate))) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate && !isNaN(Date.parse(endDate))) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  const [items, total] = await Promise.all([
    AdminAuditLog.find(query)
      .populate('admin', 'name email role profilePhotoUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim),
    AdminAuditLog.countDocuments(query),
  ]);

  res.json({ success: true, data: paginatedResponse(items, total, pg, lim) });
});

// ── GET /api/v1/admin/dashboard ───────────────────────────────────────────────
export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const [totalUsers, pendingUsers, approvedAlumni, verifiedStudents] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ verificationStatus: 'pending' }),
    User.countDocuments({ role: 'alumni', verificationStatus: 'admin_approved' }),
    User.countDocuments({ role: 'student', verificationStatus: { $in: ['email_verified', 'admin_approved'] } }),
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      pendingUsers,
      approvedAlumni,
      verifiedStudents,
      totalEvents: 0,
      totalJobs: 0,
    },
  });
});

// ── GET /api/v1/admin/analytics/overview ──────────────────────────────────────
export const getAnalyticsOverview = asyncHandler(async (_req: Request, res: Response) => {
  const [
    totalUsers,
    verifiedAlumni,
    verifiedStudents,
    pendingVerification,
    suspendedUsers,
    deactivatedUsers,
    byRoleAgg,
    mentorshipTotal,
    mentorshipAccepted,
    mentorshipCompleted,
    mentorshipPending,
    mentorshipRejected,
    referralTotal,
    referralAccepted,
    referralPending,
    referralRejected,
    referralWithdrawn,
    connectionsAccepted,
    connectionsPending,
    jobsTotal,
    jobsOpen,
    jobsClosed,
    eventsTotal,
    eventsRsvpsAgg,
    messagingTotalConversations,
    messagingTotalMessages,
    topDepartmentsAgg,
    topCompaniesAgg,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'alumni', verificationStatus: 'admin_approved', accountStatus: 'active' }),
    User.countDocuments({ role: 'student', verificationStatus: { $in: ['email_verified', 'admin_approved'] }, accountStatus: 'active' }),
    User.countDocuments({ verificationStatus: 'pending' }),
    User.countDocuments({ accountStatus: 'suspended' }),
    User.countDocuments({ accountStatus: 'deactivated' }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),

    MentorshipRequest.countDocuments({}),
    MentorshipRequest.countDocuments({ status: 'accepted' }),
    MentorshipRequest.countDocuments({ status: 'completed' }),
    MentorshipRequest.countDocuments({ status: 'pending' }),
    MentorshipRequest.countDocuments({ status: 'rejected' }),

    ReferralRequest.countDocuments({}),
    ReferralRequest.countDocuments({ status: 'accepted' }),
    ReferralRequest.countDocuments({ status: 'pending' }),
    ReferralRequest.countDocuments({ status: 'rejected' }),
    ReferralRequest.countDocuments({ status: 'withdrawn' }),

    ConnectionRequest.countDocuments({ status: 'accepted' }),
    ConnectionRequest.countDocuments({ status: 'pending' }),

    Job.countDocuments({}),
    Job.countDocuments({ status: 'open' }),
    Job.countDocuments({ status: 'closed' }),

    Event.countDocuments({ approvalStatus: 'approved' }),
    Event.aggregate([
      { $match: { approvalStatus: 'approved' } },
      { $unwind: { path: '$rsvps', preserveNullAndEmptyArrays: false } },
      { $match: { 'rsvps.status': 'attending' } },
      { $count: 'totalRsvps' },
    ]),

    Conversation.countDocuments({}),
    Message.countDocuments({}),

    User.aggregate([
      { $match: { department: { $exists: true, $ne: '' } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    User.aggregate([
      { $match: { role: 'alumni', company: { $exists: true, $ne: '' } } },
      { $group: { _id: '$company', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const byRole: Record<string, number> = { student: 0, alumni: 0, admin: 0 };
  byRoleAgg.forEach((item) => {
    if (item._id && byRole[item._id] !== undefined) {
      byRole[item._id] = item.count;
    }
  });

  const totalRsvps = eventsRsvpsAgg[0]?.totalRsvps || 0;

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        verifiedAlumni,
        verifiedStudents,
        pendingVerification,
        suspended: suspendedUsers,
        deactivated: deactivatedUsers,
        byRole,
      },
      modules: {
        mentorship: {
          total: mentorshipTotal,
          accepted: mentorshipAccepted,
          completed: mentorshipCompleted,
          pending: mentorshipPending,
          rejected: mentorshipRejected,
        },
        referrals: {
          total: referralTotal,
          accepted: referralAccepted,
          pending: referralPending,
          rejected: referralRejected,
          withdrawn: referralWithdrawn,
        },
        connections: {
          totalAccepted: connectionsAccepted,
          totalPending: connectionsPending,
        },
        jobs: {
          total: jobsTotal,
          open: jobsOpen,
          closed: jobsClosed,
        },
        events: {
          total: eventsTotal,
          totalRsvps,
        },
        messaging: {
          totalConversations: messagingTotalConversations,
          totalMessages: messagingTotalMessages,
        },
      },
      distributions: {
        topDepartments: topDepartmentsAgg.map((d) => ({ name: d._id, count: d.count })),
        topCompanies: topCompaniesAgg.map((c) => ({ name: c._id, count: c.count })),
      },
    },
  });
});

// ── GET /api/v1/admin/analytics/activity ──────────────────────────────────────
export const getAnalyticsActivity = asyncHandler(async (req: Request, res: Response) => {
  const validation = analyticsActivityQuerySchema.safeParse(req.query);
  if (!validation.success) {
    throw createError(
      validation.error.errors.map((e) => e.message).join(', '),
      400,
      'VALIDATION_ERROR'
    );
  }

  const { days } = validation.data;
  const now = new Date();
  const sinceDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  sinceDate.setUTCHours(0, 0, 0, 0);

  const [userAgg, connectionAgg, messageAgg] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: sinceDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    ConnectionRequest.aggregate([
      { $match: { createdAt: { $gte: sinceDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    Message.aggregate([
      { $match: { createdAt: { $gte: sinceDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
  ]);

  const userMap = new Map<string, number>(userAgg.map((item) => [item._id, item.count]));
  const connectionMap = new Map<string, number>(connectionAgg.map((item) => [item._id, item.count]));
  const messageMap = new Map<string, number>(messageAgg.map((item) => [item._id, item.count]));

  // Generate continuous chronological date array
  const timeline: Array<{ date: string; newUsers: number; newConnections: number; messagesSent: number }> = [];
  const currentDate = new Date(sinceDate);

  while (currentDate <= now || timeline.length < days) {
    const dateStr = currentDate.toISOString().split('T')[0];
    timeline.push({
      date: dateStr,
      newUsers: userMap.get(dateStr) || 0,
      newConnections: connectionMap.get(dateStr) || 0,
      messagesSent: messageMap.get(dateStr) || 0,
    });
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    if (timeline.length >= days) break;
  }

  res.json({
    success: true,
    data: {
      days,
      timeline,
    },
  });
});

// ── POST /api/v1/admin/users/bulk-action ──────────────────────────────────────
export const bulkUserAction = asyncHandler(async (req: Request, res: Response) => {
  const currentUserId = req.user!._id;
  const validation = bulkUserActionSchema.safeParse(req.body);
  if (!validation.success) {
    throw createError(
      validation.error.errors.map((e) => e.message).join(', '),
      400,
      'VALIDATION_ERROR'
    );
  }

  const { action, userIds, reason } = validation.data;
  const uniqueUserIds = Array.from(new Set(userIds));

  const succeeded: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  // Check how many active admins exist total
  let totalActiveAdmins = await User.countDocuments({
    role: 'admin',
    accountStatus: 'active',
  });

  for (const id of uniqueUserIds) {
    // 1. Self-action check
    if (id === currentUserId.toString()) {
      failed.push({ id, reason: 'You cannot perform this bulk action on your own account.' });
      continue;
    }

    // 2. Query target user
    const targetUser = await User.findById(id);
    if (!targetUser) {
      failed.push({ id, reason: 'User not found.' });
      continue;
    }

    // 3. Action execution
    try {
      if (action === 'approve') {
        await authService.approveUser(id);
        await AdminAuditLog.create({
          admin: currentUserId,
          action: 'user.bulk_approve',
          targetType: 'user',
          targetId: targetUser._id,
          metadata: { reason: reason || undefined, batchSize: uniqueUserIds.length },
        });
        succeeded.push(id);
      } else if (action === 'reject') {
        await authService.rejectUser(id, reason!);
        await AdminAuditLog.create({
          admin: currentUserId,
          action: 'user.bulk_reject',
          targetType: 'user',
          targetId: targetUser._id,
          metadata: { reason, batchSize: uniqueUserIds.length },
        });
        succeeded.push(id);
      } else if (action === 'suspend') {
        const canSuspend = await runAdminProtectedAction(async () => {
          if (targetUser.role === 'admin' && targetUser.accountStatus === 'active') {
            const currentActiveAdmins = await User.countDocuments({
              role: 'admin',
              accountStatus: 'active',
              _id: { $ne: targetUser._id },
            });
            if (currentActiveAdmins === 0) {
              return false;
            }
          }
          await authService.suspendUser(id);
          return true;
        });

        if (!canSuspend) {
          failed.push({ id, reason: 'Cannot suspend the last active administrator account.' });
          continue;
        }

        await AdminAuditLog.create({
          admin: currentUserId,
          action: 'user.bulk_suspend',
          targetType: 'user',
          targetId: targetUser._id,
          metadata: { reason, batchSize: uniqueUserIds.length },
        });
        succeeded.push(id);
      } else if (action === 'reactivate') {
        await authService.reactivateUser(id);
        await AdminAuditLog.create({
          admin: currentUserId,
          action: 'user.bulk_reactivate',
          targetType: 'user',
          targetId: targetUser._id,
          metadata: { reason: reason || undefined, batchSize: uniqueUserIds.length },
        });
        succeeded.push(id);
      }
    } catch (err: any) {
      failed.push({ id, reason: err.message || 'Operation failed.' });
    }
  }

  res.json({
    success: true,
    data: {
      action,
      processed: uniqueUserIds.length,
      succeeded,
      failed,
    },
  });
});
