import { Request, Response } from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { asyncHandler, createError } from '../middleware/errorHandler';
import VerificationRequest from '../models/VerificationRequest';
import College from '../models/College';
import User from '../models/User';
import AdminAuditLog from '../models/AdminAuditLog';
import { storageService } from '../services/storage';
import { validateProofDocumentBuffer } from '../utils/verificationUpload';
import { paginate, paginatedResponse } from '../utils/helpers';
import { rejectVerificationSchema } from '../validators/verification';

/** Helper to match exact case-normalized domain */
function checkCollegeDomainMatch(email: string, collegeDomains: string[]): boolean {
  const userDomain = email.split('@')[1]?.toLowerCase().trim();
  if (!userDomain) return false;
  return collegeDomains.some((d) => d.toLowerCase().trim() === userDomain);
}

// ── POST /api/v1/verification-requests ────────────────────────────────────────
export const submitVerificationRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const userRole = req.user!.role as 'student' | 'alumni';

  const user = await User.findById(userId);
  if (!user) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  if (user.accountStatus !== 'active') {
    throw createError('Suspended or deactivated accounts cannot submit verification requests.', 403, 'ACCOUNT_SUSPENDED');
  }

  const { collegeId, note } = req.body;
  if (!collegeId || !mongoose.Types.ObjectId.isValid(collegeId)) {
    throw createError('A valid college selection is required.', 400, 'VALIDATION_ERROR');
  }

  const college = await College.findById(collegeId);
  if (!college || !college.isActive) {
    throw createError('Selected college is invalid or inactive.', 404, 'COLLEGE_NOT_FOUND');
  }

  // Check if user already has an active pending request
  const existingPending = await VerificationRequest.findOne({
    user: userId,
    status: 'pending',
  });

  if (existingPending) {
    throw createError(
      'You already have an institutional verification request pending review.',
      409,
      'REQUEST_ALREADY_PENDING'
    );
  }

  const isDomainMatch = checkCollegeDomainMatch(user.email, college.domains);

  // Document requirement policy
  if (userRole === 'alumni' && !req.file) {
    throw createError(
      'Alumni verification unconditionally requires an official proof document.',
      400,
      'DOCUMENT_REQUIRED'
    );
  }

  if (userRole === 'student' && !isDomainMatch && !req.file) {
    throw createError(
      'A proof document is required for verification with a non-institutional email domain.',
      400,
      'DOCUMENT_REQUIRED'
    );
  }

  let documentData: any = null;
  if (req.file) {
    const validation = validateProofDocumentBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    if (!validation.valid) {
      throw createError(validation.error || 'Invalid proof document.', 400, validation.code || 'VALIDATION_ERROR');
    }

    const saved = await storageService.savePrivate(req.file, 'verification_docs');
    const sanitizedName = path.basename(req.file.originalname).replace(/[^\w.-]/g, '_');

    documentData = {
      originalName: sanitizedName,
      storagePath: saved.storagePath,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };
  }

  const verificationRequest = await VerificationRequest.create({
    user: userId,
    college: college._id,
    role: userRole,
    status: 'pending',
    collegeDomainVerified: isDomainMatch,
    document: documentData,
    note: note ? note.trim() : undefined,
  });

  // Update user with selected college and domain status
  user.college = college._id;
  user.collegeDomainVerified = isDomainMatch;
  await user.save();

  const populated = await VerificationRequest.findById(verificationRequest._id)
    .populate('college', 'name code domains location website');

  res.status(201).json({
    success: true,
    data: { verificationRequest: populated },
  });
});

// ── GET /api/v1/verification-requests/me ──────────────────────────────────────
export const getMyVerificationRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;

  const verificationRequest = await VerificationRequest.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .populate('college', 'name code domains location website');

  res.json({
    success: true,
    data: { verificationRequest },
  });
});

// ── POST /api/v1/verification-requests/resubmit ──────────────────────────────
export const resubmitVerificationRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const userRole = req.user!.role as 'student' | 'alumni';

  const user = await User.findById(userId);
  if (!user) {
    throw createError('User not found.', 404, 'NOT_FOUND');
  }

  if (user.accountStatus !== 'active') {
    throw createError('Suspended or deactivated accounts cannot resubmit verification requests.', 403, 'ACCOUNT_SUSPENDED');
  }

  // Precondition: user must have rejected standing or a prior rejected request
  const hasRejected = await VerificationRequest.findOne({ user: userId, status: 'rejected' });
  if (user.verificationStatus !== 'rejected' && !hasRejected) {
    throw createError('No rejected verification request found to resubmit.', 400, 'NO_REJECTED_REQUEST');
  }

  const { collegeId, note } = req.body;
  if (!collegeId || !mongoose.Types.ObjectId.isValid(collegeId)) {
    throw createError('A valid college selection is required.', 400, 'VALIDATION_ERROR');
  }

  const college = await College.findById(collegeId);
  if (!college || !college.isActive) {
    throw createError('Selected college is invalid or inactive.', 404, 'COLLEGE_NOT_FOUND');
  }

  const isDomainMatch = checkCollegeDomainMatch(user.email, college.domains);

  // Document requirement policy
  if (userRole === 'alumni' && !req.file) {
    throw createError(
      'Alumni verification unconditionally requires an official proof document.',
      400,
      'DOCUMENT_REQUIRED'
    );
  }

  if (userRole === 'student' && !isDomainMatch && !req.file) {
    throw createError(
      'A proof document is required for verification with a non-institutional email domain.',
      400,
      'DOCUMENT_REQUIRED'
    );
  }

  // Supersede prior pending or rejected requests for clean atomic resubmission
  await VerificationRequest.updateMany(
    { user: userId, status: { $in: ['pending', 'rejected'] } },
    { status: 'superseded' }
  );

  let documentData: any = null;
  if (req.file) {
    const validation = validateProofDocumentBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    if (!validation.valid) {
      throw createError(validation.error || 'Invalid proof document.', 400, validation.code || 'VALIDATION_ERROR');
    }

    const saved = await storageService.savePrivate(req.file, 'verification_docs');
    const sanitizedName = path.basename(req.file.originalname).replace(/[^\w.-]/g, '_');

    documentData = {
      originalName: sanitizedName,
      storagePath: saved.storagePath,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };
  }

  const verificationRequest = await VerificationRequest.create({
    user: userId,
    college: college._id,
    role: userRole,
    status: 'pending',
    collegeDomainVerified: isDomainMatch,
    document: documentData,
    note: note ? note.trim() : undefined,
  });

  // §0.1 Resubmission enum transition: rejected -> email_verified
  if (user.verificationStatus === 'rejected') {
    user.verificationStatus = 'email_verified';
  }
  user.rejectionReason = undefined;
  user.college = college._id;
  user.collegeDomainVerified = isDomainMatch;
  await user.save();

  const populated = await VerificationRequest.findById(verificationRequest._id)
    .populate('college', 'name code domains location website');

  res.status(201).json({
    success: true,
    data: {
      message: 'Verification request resubmitted for administrative review.',
      verificationRequest: populated,
    },
  });
});

// ── GET /api/v1/verification-requests/:id/document ────────────────────────────
export const downloadVerificationDocument = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const sendNotFound = () => {
    res.status(404).json({
      success: false,
      error: { code: 'DOCUMENT_NOT_FOUND', message: 'Verification document not found.' },
    });
  };

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    sendNotFound();
    return;
  }

  const requestDoc = await VerificationRequest.findById(id).select('+document.storagePath');
  if (!requestDoc || !requestDoc.document || !requestDoc.document.storagePath) {
    sendNotFound();
    return;
  }

  const requester = req.user!;
  const isOwner = requester._id.toString() === requestDoc.user.toString();
  const isAdmin = requester.role === 'admin';

  // §20 Security: Non-authorized caller receives the exact same 404 as a non-existent document
  if (!isOwner && !isAdmin) {
    sendNotFound();
    return;
  }

  const storagePath = requestDoc.document.storagePath;
  const originalName = requestDoc.document.originalName || 'verification_document.pdf';
  const mimeType = requestDoc.document.mimeType || 'application/pdf';

  let filePath: string;
  try {
    filePath = storageService.getPrivateFilePath(storagePath);
  } catch {
    sendNotFound();
    return;
  }

  if (!fs.existsSync(filePath)) {
    sendNotFound();
    return;
  }

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.sendFile(filePath);
});

// ── Admin: GET /api/v1/admin/verification-requests ────────────────────────────
export const listAdminVerificationRequests = asyncHandler(async (req: Request, res: Response) => {
  const {
    status,
    role,
    collegeId,
    search,
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const { skip, limit: lim, page: pg } = paginate(+page, +limit);
  const filter: Record<string, any> = {};

  if (status && ['pending', 'approved', 'rejected', 'superseded'].includes(status)) {
    filter.status = status;
  }

  if (role && ['student', 'alumni'].includes(role)) {
    filter.role = role;
  }

  if (collegeId && mongoose.Types.ObjectId.isValid(collegeId)) {
    filter.college = new mongoose.Types.ObjectId(collegeId);
  }

  let userMatchIds: mongoose.Types.ObjectId[] | null = null;
  if (search && search.trim()) {
    const term = search.trim();
    const matchingUsers = await User.find({
      $or: [
        { name: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { department: { $regex: term, $options: 'i' } },
        { batch: { $regex: term, $options: 'i' } },
      ],
    }).select('_id');
    userMatchIds = matchingUsers.map((u) => u._id);
    filter.user = { $in: userMatchIds };
  }

  const [items, total] = await Promise.all([
    VerificationRequest.find(filter)
      .populate('user', 'name email role department batch profilePhotoUrl accountStatus verificationStatus')
      .populate('college', 'name code domains location website')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim),
    VerificationRequest.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: paginatedResponse(items, total, pg, lim),
  });
});

// ── Admin: PATCH /api/v1/admin/verification-requests/:id/approve ──────────────
export const approveAdminVerificationRequest = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError('Verification request not found.', 404, 'NOT_FOUND');
  }

  // §11 Concurrency: State-gated atomic transition from pending to approved
  const requestDoc = await VerificationRequest.findOneAndUpdate(
    { _id: id, status: 'pending' },
    {
      status: 'approved',
      reviewedBy: req.user!._id,
      reviewedAt: new Date(),
    },
    { new: true }
  );

  if (!requestDoc) {
    throw createError(
      'Verification request was not found or has already been reviewed.',
      404,
      'REQUEST_NOT_PENDING'
    );
  }

  // Update target user to admin_approved
  const user = await User.findByIdAndUpdate(
    requestDoc.user,
    {
      verificationStatus: 'admin_approved',
      college: requestDoc.college,
      collegeDomainVerified: requestDoc.collegeDomainVerified,
      rejectionReason: undefined,
    },
    { new: true }
  ).select('-passwordHash -refreshTokenHash');

  await AdminAuditLog.create({
    admin: req.user!._id,
    action: 'verification.approve',
    targetType: 'verification_request',
    targetId: requestDoc._id,
    metadata: {
      userId: requestDoc.user,
      collegeId: requestDoc.college,
      collegeDomainVerified: requestDoc.collegeDomainVerified,
    },
  }).catch(() => {});

  res.json({
    success: true,
    data: {
      message: 'Institutional verification request approved successfully.',
      verificationRequest: requestDoc,
      user,
    },
  });
});

// ── Admin: PATCH /api/v1/admin/verification-requests/:id/reject ───────────────
export const rejectAdminVerificationRequest = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError('Verification request not found.', 404, 'NOT_FOUND');
  }

  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw createError('A rejection reason (min 5 characters) is required.', 400, 'VALIDATION_ERROR');
  }

  const trimmedReason = reason.trim();

  // §11 Concurrency: State-gated atomic transition from pending to rejected
  const requestDoc = await VerificationRequest.findOneAndUpdate(
    { _id: id, status: 'pending' },
    {
      status: 'rejected',
      rejectionReason: trimmedReason,
      reviewedBy: req.user!._id,
      reviewedAt: new Date(),
    },
    { new: true }
  );

  if (!requestDoc) {
    throw createError(
      'Verification request was not found or has already been reviewed.',
      404,
      'REQUEST_NOT_PENDING'
    );
  }

  // Update target user to rejected
  const user = await User.findByIdAndUpdate(
    requestDoc.user,
    {
      verificationStatus: 'rejected',
      rejectionReason: trimmedReason,
    },
    { new: true }
  ).select('-passwordHash -refreshTokenHash');

  await AdminAuditLog.create({
    admin: req.user!._id,
    action: 'verification.reject',
    targetType: 'verification_request',
    targetId: requestDoc._id,
    metadata: {
      userId: requestDoc.user,
      collegeId: requestDoc.college,
      reason: trimmedReason,
    },
  }).catch(() => {});

  res.json({
    success: true,
    data: {
      message: 'Institutional verification request rejected.',
      verificationRequest: requestDoc,
      user,
    },
  });
});
