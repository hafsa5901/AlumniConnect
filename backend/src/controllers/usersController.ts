import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import User, { SAFE_USER_FIELDS } from '../models/User';
import MentorshipRequest from '../models/MentorshipRequest';
import { calculateProfileCompletion } from '../utils/profileCompletion';
import { storageService } from '../services/storage';

function validateResumeFileBuffer(
  buffer: Buffer,
  mimetype: string,
  originalname: string
): { valid: boolean; error?: string; code?: string } {
  const ext = path.extname(originalname).toLowerCase();
  const allowedExts = ['.pdf', '.doc', '.docx'];

  if (!allowedExts.includes(ext)) {
    return {
      valid: false,
      error: 'Invalid file extension. Allowed extensions are .pdf, .doc, .docx.',
      code: 'INVALID_EXTENSION',
    };
  }

  // Check MIME / extension agreement
  if (ext === '.pdf' && mimetype !== 'application/pdf') {
    return { valid: false, error: 'MIME type and file extension mismatch for PDF.', code: 'MIME_EXTENSION_MISMATCH' };
  }
  if (ext === '.doc' && mimetype !== 'application/msword') {
    return { valid: false, error: 'MIME type and file extension mismatch for DOC.', code: 'MIME_EXTENSION_MISMATCH' };
  }
  if (ext === '.docx' && mimetype !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return { valid: false, error: 'MIME type and file extension mismatch for DOCX.', code: 'MIME_EXTENSION_MISMATCH' };
  }

  // Check magic bytes
  if (buffer.length < 4) {
    return { valid: false, error: 'File is empty or corrupted.', code: 'FILE_CORRUPTED_OR_SPOOFED' };
  }

  if (ext === '.pdf') {
    // %PDF -> 0x25 0x50 0x44 0x46
    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    if (!isPdf) {
      return { valid: false, error: 'File content does not match PDF format.', code: 'FILE_CORRUPTED_OR_SPOOFED' };
    }
  } else if (ext === '.doc') {
    // OLE Compound File Header -> D0 CF 11 E0
    const isDoc = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
    if (!isDoc) {
      return { valid: false, error: 'File content does not match DOC format.', code: 'FILE_CORRUPTED_OR_SPOOFED' };
    }
  } else if (ext === '.docx') {
    // PK Zip Header -> 50 4B 03 04
    const isDocx = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!isDocx) {
      return { valid: false, error: 'File content does not match DOCX format.', code: 'FILE_CORRUPTED_OR_SPOOFED' };
    }
  }

  return { valid: true };
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const user = await User.findById(userId).select(SAFE_USER_FIELDS);
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found.' },
    });
    return;
  }

  const profileCompletion = calculateProfileCompletion(user);
  const hasResume = Boolean(user.resume && user.resume.originalName);

  res.status(200).json({
    success: true,
    data: {
      user,
      profileCompletion,
      hasResume,
    },
  });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found.' },
    });
    return;
  }

  const role = user.role;
  const body = req.body || {};

  // Server-side strict field filtering by role
  const updates: Record<string, any> = {};

  // Fields allowed for all roles (student, alumni, admin)
  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.location !== undefined) updates.location = body.location;
  if (body.skills !== undefined && Array.isArray(body.skills)) updates.skills = body.skills;
  if (body.education !== undefined && Array.isArray(body.education)) updates.education = body.education;
  if (body.links !== undefined && typeof body.links === 'object') updates.links = body.links;

  // Fields allowed exclusively for alumni
  if (role === 'alumni') {
    if (body.company !== undefined) updates.company = body.company;
    if (body.designation !== undefined) updates.designation = body.designation;
    if (body.experience !== undefined && Array.isArray(body.experience)) updates.experience = body.experience;
    if (body.mentorshipEnabled !== undefined) updates.mentorshipEnabled = Boolean(body.mentorshipEnabled);
  }

  // Apply updates to Mongoose document
  Object.assign(user, updates);
  await user.save();

  const safeUser = await User.findById(userId).select(SAFE_USER_FIELDS);
  const profileCompletion = calculateProfileCompletion(safeUser);
  const hasResume = Boolean(safeUser?.resume && safeUser.resume.originalName);

  res.status(200).json({
    success: true,
    data: {
      user: safeUser,
      profileCompletion,
      hasResume,
    },
  });
}

export async function uploadPhoto(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found.' },
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No image file provided.' },
    });
    return;
  }

  // Save new avatar file
  const oldPhotoUrl = user.profilePhotoUrl;
  const newPhotoUrl = await storageService.save(req.file, 'avatars');

  // If old photo was stored locally, clean it up
  if (oldPhotoUrl && oldPhotoUrl !== newPhotoUrl) {
    await storageService.delete(oldPhotoUrl);
  }

  user.profilePhotoUrl = newPhotoUrl;
  await user.save();

  res.status(200).json({
    success: true,
    data: {
      profilePhotoUrl: newPhotoUrl,
    },
  });
}

export async function uploadResume(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const user = await User.findById(userId).select('+resume.storagePath');
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found.' },
    });
    return;
  }

  if (user.accountStatus !== 'active') {
    res.status(403).json({
      success: false,
      error: { code: 'ACCOUNT_SUSPENDED', message: 'Suspended or deactivated accounts cannot upload resumes.' },
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No resume file provided.' },
    });
    return;
  }

  // Validate buffer, mime, extension, and magic bytes
  const validation = validateResumeFileBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: { code: validation.code || 'VALIDATION_ERROR', message: validation.error || 'Invalid resume file.' },
    });
    return;
  }

  const oldStoragePath = user.resume?.storagePath;

  // Persist private file
  const saved = await storageService.savePrivate(req.file, 'resumes');

  // Sanitize originalName for display
  const sanitizedOriginalName = path.basename(req.file.originalname).replace(/[^\w.-]/g, '_');

  user.resume = {
    originalName: sanitizedOriginalName,
    storagePath: saved.storagePath,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedAt: new Date(),
  };

  try {
    await user.save();
  } catch (saveErr) {
    await storageService.deletePrivate(saved.storagePath);
    throw saveErr;
  }

  // Clean up old file after successful save
  if (oldStoragePath && oldStoragePath !== saved.storagePath) {
    await storageService.deletePrivate(oldStoragePath);
  }

  res.status(200).json({
    success: true,
    data: {
      resume: {
        originalName: user.resume.originalName,
        mimeType: user.resume.mimeType,
        size: user.resume.size,
        uploadedAt: user.resume.uploadedAt,
      },
    },
  });
}

export async function deleteResume(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const user = await User.findById(userId).select('+resume.storagePath');
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found.' },
    });
    return;
  }

  if (user.accountStatus !== 'active') {
    res.status(403).json({
      success: false,
      error: { code: 'ACCOUNT_SUSPENDED', message: 'Suspended or deactivated accounts cannot delete resumes.' },
    });
    return;
  }

  if (!user.resume || !user.resume.originalName) {
    res.status(404).json({
      success: false,
      error: { code: 'RESUME_NOT_FOUND', message: 'No resume found to delete.' },
    });
    return;
  }

  const oldStoragePath = user.resume.storagePath;
  user.resume = null;
  await user.save();

  if (oldStoragePath) {
    await storageService.deletePrivate(oldStoragePath);
  }

  res.status(200).json({
    success: true,
    data: {
      message: 'Resume deleted successfully.',
    },
  });
}

async function handleResumeDownload(targetUserId: string, requester: any, res: Response): Promise<void> {
  const sendNotFound = () => {
    res.status(404).json({
      success: false,
      error: { code: 'RESUME_NOT_FOUND', message: 'Resume not found.' },
    });
  };

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    sendNotFound();
    return;
  }

  const targetUser = await User.findById(targetUserId).select('+resume.storagePath');
  if (!targetUser || !targetUser.resume || !targetUser.resume.storagePath) {
    sendNotFound();
    return;
  }

  const isOwner = requester._id.toString() === targetUser._id.toString();
  const isAdmin = requester.role === 'admin';

  // Suspended account check: target account suspended hides resume existence from non-owner/non-admin
  if (targetUser.accountStatus !== 'active' && !isAdmin && !isOwner) {
    sendNotFound();
    return;
  }

  // Authorization check per §1
  let authorized = false;

  if (isOwner || isAdmin) {
    authorized = true;
  } else if (targetUser.role === 'alumni') {
    // Public alumni resume: must be verified and active
    if (targetUser.verificationStatus === 'admin_approved' && targetUser.accountStatus === 'active') {
      authorized = true;
    }
  } else if (targetUser.role === 'student') {
    // Student resume: private! Allowed only if requester is alumni mentor with accepted MentorshipRequest
    if (requester.role === 'alumni') {
      const hasAcceptedMentorship = await MentorshipRequest.exists({
        status: 'accepted',
        student: targetUser._id,
        mentor: requester._id,
      });
      if (hasAcceptedMentorship) {
        authorized = true;
      }
    }
  }

  if (!authorized) {
    sendNotFound();
    return;
  }

  let filePath: string;
  try {
    filePath = storageService.getPrivateFilePath(targetUser.resume.storagePath);
  } catch (pathErr) {
    sendNotFound();
    return;
  }

  if (!fs.existsSync(filePath)) {
    sendNotFound();
    return;
  }

  const ext = path.extname(targetUser.resume.originalName) || '.pdf';
  const safeBaseName = targetUser.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const downloadFilename = `${safeBaseName}_resume${ext}`;

  res.setHeader('Content-Type', targetUser.resume.mimeType || 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.sendFile(filePath);
}

export async function getMyResume(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id.toString();
  await handleResumeDownload(userId, req.user, res);
}

export async function getResumeById(req: Request, res: Response): Promise<void> {
  const targetId = req.params.id as string;
  await handleResumeDownload(targetId, req.user, res);
}
