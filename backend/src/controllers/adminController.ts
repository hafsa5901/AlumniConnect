import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as authService from '../services/authService';
import AdminAuditLog from '../models/AdminAuditLog';
import User, { SAFE_USER_FIELDS } from '../models/User';
import { paginate, paginatedResponse } from '../utils/helpers';

// ── GET /api/v1/admin/users ───────────────────────────────────────────────────
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { status, role, page = '1', limit = '20' } = req.query as Record<string, string>;
  const { skip, limit: lim, page: pg } = paginate(+page, +limit);

  const filter: Record<string, string> = {};
  if (status) filter.verificationStatus = status;
  if (role) filter.role = role;

  const [items, total] = await Promise.all([
    User.find(filter)
      .select(SAFE_USER_FIELDS + ' +verificationNote +verificationDocUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, data: paginatedResponse(items, total, pg, lim) });
});

// ── PATCH /api/v1/admin/users/:id/approve ────────────────────────────────────
export const approveUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
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
  const user = await authService.suspendUser(userId);

  await AdminAuditLog.create({
    admin: req.user!._id,
    action: 'user.suspend',
    targetType: 'user',
    targetId: user._id,
    metadata: {},
  });

  res.json({ success: true, data: { user } });
});

// ── PATCH /api/v1/admin/users/:id/reactivate ─────────────────────────────────
export const reactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
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

// ── GET /api/v1/admin/audit-logs ─────────────────────────────────────────────
export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query as Record<string, string>;
  const { skip, limit: lim, page: pg } = paginate(+page, +limit);

  const [items, total] = await Promise.all([
    AdminAuditLog.find()
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim),
    AdminAuditLog.countDocuments(),
  ]);

  res.json({ success: true, data: paginatedResponse(items, total, pg, lim) });
});

// ── GET /api/v1/admin/dashboard ───────────────────────────────────────────────
export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const [totalUsers, pendingUsers, approvedAlumni, verifiedStudents, totalEvents, totalJobs] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ verificationStatus: 'pending' }),
      User.countDocuments({ role: 'alumni', verificationStatus: 'admin_approved' }),
      User.countDocuments({ role: 'student', verificationStatus: { $in: ['email_verified', 'admin_approved'] } }),
      // Events and Jobs models added in later phases — return 0 for now
      Promise.resolve(0),
      Promise.resolve(0),
    ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      pendingUsers,
      approvedAlumni,
      verifiedStudents,
      totalEvents,
      totalJobs,
    },
  });
});
