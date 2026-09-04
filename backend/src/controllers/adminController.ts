import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler, createError } from '../middleware/errorHandler';
import * as authService from '../services/authService';
import AdminAuditLog from '../models/AdminAuditLog';
import User, { IUser, SAFE_USER_FIELDS } from '../models/User';
import { paginate, paginatedResponse } from '../utils/helpers';

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
