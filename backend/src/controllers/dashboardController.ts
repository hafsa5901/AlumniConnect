import { Request, Response } from 'express';
import User, { SAFE_USER_FIELDS } from '../models/User';
import AdminAuditLog from '../models/AdminAuditLog';
import { calculateProfileCompletion } from '../utils/profileCompletion';
import { env } from '../config/env';

export async function getStudentDashboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
    return;
  }

  const profileCompletion = calculateProfileCompletion(user);

  // 4-6 verified & active alumni preview
  const alumniPreview = await User.find({
    role: 'alumni',
    verificationStatus: 'admin_approved',
    accountStatus: 'active',
  })
    .select('name profilePhotoUrl designation company department batch skills location mentorshipEnabled')
    .limit(6);

  res.status(200).json({
    success: true,
    data: {
      profileCompletion,
      alumniPreview,
      recentActivity: [],
    },
  });
}

export async function getAlumniDashboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
    return;
  }

  const profileCompletion = calculateProfileCompletion(user);

  const professionalSummary = {
    company: user.company || '',
    designation: user.designation || '',
    location: user.location || '',
    skills: user.skills || [],
    mentorshipEnabled: user.mentorshipEnabled,
  };

  const [departmentAlumniCount, batchAlumniCount] = await Promise.all([
    user.department
      ? User.countDocuments({
          role: 'alumni',
          verificationStatus: 'admin_approved',
          accountStatus: 'active',
          department: user.department,
        })
      : 0,
    user.batch
      ? User.countDocuments({
          role: 'alumni',
          verificationStatus: 'admin_approved',
          accountStatus: 'active',
          batch: user.batch,
        })
      : 0,
  ]);

  res.status(200).json({
    success: true,
    data: {
      profileCompletion,
      professionalSummary,
      networkStats: {
        departmentAlumniCount,
        batchAlumniCount,
      },
      recentActivity: [],
    },
  });
}

export async function getAdminDashboard(_req: Request, res: Response): Promise<void> {
  const isStudentAdminApprovalRequired = env.STUDENT_REQUIRES_ADMIN_APPROVAL;

  const studentVerificationQuery = isStudentAdminApprovalRequired
    ? { role: 'student', verificationStatus: 'admin_approved', accountStatus: 'active' }
    : { role: 'student', verificationStatus: { $in: ['email_verified', 'admin_approved'] }, accountStatus: 'active' };

  const [
    totalUsers,
    verifiedAlumni,
    verifiedStudents,
    pendingVerifications,
    suspendedUsers,
    byRole,
    byVerificationStatus,
    byDepartment,
    recentAuditLogs,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'alumni', verificationStatus: 'admin_approved', accountStatus: 'active' }),
    User.countDocuments(studentVerificationQuery),
    User.countDocuments({ verificationStatus: 'pending' }),
    User.countDocuments({ accountStatus: 'suspended' }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$verificationStatus', count: { $sum: 1 } } }]),
    User.aggregate([
      { $match: { department: { $exists: true, $ne: '' } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    AdminAuditLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('admin', 'name email')
      .lean(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      metrics: {
        totalUsers,
        verifiedAlumni,
        verifiedStudents,
        pendingVerifications,
        suspendedUsers,
      },
      distributions: {
        byRole: byRole.map((item) => ({ role: item._id, count: item.count })),
        byVerificationStatus: byVerificationStatus.map((item) => ({
          status: item._id,
          count: item.count,
        })),
        byDepartment: byDepartment.map((item) => ({
          department: item._id,
          count: item.count,
        })),
      },
      recentAuditLogs,
    },
  });
}
